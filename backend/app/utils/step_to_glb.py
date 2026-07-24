"""STEP → GLB converter (per-solid coloring).

Uses `gmsh` to load a STEP file and tessellate each distinct 3D solid
into its own mesh, then writes them out as a **multi-material** GLB via
`trimesh.Scene` so the Babylon.js viewer shows the assembly with each
part in a different colour (matching the way FreeCAD / KiCAD / online
STEP viewers render CAD assemblies).

Colours are ORIGINAL STEP colours when they can be extracted from the
file's `STYLED_ITEM` / `COLOUR_RGB` entities, otherwise a distinct
value from a CAD-palette fallback per solid. Solid enumeration is
stable — the same STEP file always yields the same solid ordering, so
colours don't shuffle between uploads.

Why gmsh + trimesh rather than OCP directly:
  · OCP (cadquery-ocp) ships an unsigned DLL. On Windows with WDAC
    (Application Control) enabled, its load fails.
  · gmsh ships its own signed native binaries and loads fine.
  · trimesh handles GLB writing cleanly.

Design notes
------------
· Tessellation resolution controlled by `char_length_max` (mm).
· Per-solid meshes are separate `trimesh.Trimesh` geometries in a
  `trimesh.Scene`; GLB export packages them as distinct primitives, so
  Babylon can render each with its own PBR material.
· Blocking call on the request thread. For files >5 MB expect
  several seconds; consider a Celery task in production.
"""

from __future__ import annotations

import io
import logging
import re
import tempfile
from pathlib import Path

import gmsh
import numpy as np
import trimesh

logger = logging.getLogger(__name__)


# CAD-viewer style palette used when the STEP file has no embedded colour
# for a given solid. Ordered to give visual contrast between adjacent
# solids in the assembly. Matches the way FreeCAD / KiCAD colour parts
# by default.
FALLBACK_PALETTE: tuple[tuple[float, float, float], ...] = (
    (0.94, 0.55, 0.10),  # orange
    (0.98, 0.82, 0.12),  # yellow
    (0.36, 0.62, 0.94),  # blue
    (0.85, 0.85, 0.88),  # silver / light grey
    (0.42, 0.75, 0.42),  # green
    (0.85, 0.32, 0.32),  # red
    (0.62, 0.40, 0.85),  # purple
    (0.30, 0.75, 0.75),  # teal
)


def _extract_step_colours(step_text: str) -> list[tuple[float, float, float]]:
    """Best-effort extraction of RGB triples from a STEP file's XCAF colour
    entities. Not all STEP files have them; returns [] if none found.

    STEP colours look like:
        #123 = COLOUR_RGB('', 0.941176, 0.549020, 0.098039);
    """
    pattern = re.compile(
        r"COLOUR_RGB\s*\(\s*'[^']*'\s*,\s*([\d.eE+-]+)\s*,\s*([\d.eE+-]+)\s*,\s*([\d.eE+-]+)\s*\)"
    )
    colours: list[tuple[float, float, float]] = []
    for match in pattern.finditer(step_text):
        try:
            r, g, b = (float(v) for v in match.groups())
        except ValueError:
            continue
        # Clamp defensively — STEP allows out-of-range values in practice.
        colours.append((max(0.0, min(1.0, r)), max(0.0, min(1.0, g)), max(0.0, min(1.0, b))))
    return colours


def step_bytes_to_glb_bytes(
    step_bytes: bytes,
    *,
    char_length_max: float | None = None,
) -> bytes:
    """Convert raw STEP file bytes to raw GLB file bytes.

    Args:
        step_bytes: The raw bytes of a `.step`/`.stp` file.
        char_length_max: Max mesh element size in the STEP file's units
            (mm for most CAD). Smaller = finer mesh. When None (default),
            chosen adaptively from the model's bounding-box diagonal so
            small parts (~50mm) render at ~1mm resolution and large
            assemblies (~1m) coarsen to ~10-20mm — keeps output GLB
            under ~5MB for typical parts, avoiding the previous 45MB
            outputs on the NIST CAD test suite that stalled browsers.

    Raises:
        ValueError: STEP file couldn't be parsed / produced no geometry
            even after fallback to whole-model tessellation.
    """
    # Parse RGB colours from the raw STEP text — cheap and doesn't need
    # any XCAF library.
    try:
        step_text = step_bytes.decode("utf-8", errors="ignore")
    except Exception:
        step_text = ""
    step_colours = _extract_step_colours(step_text)

    # gmsh reads from files; write bytes to a temp file first.
    with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as tmp:
        tmp.write(step_bytes)
        step_path = Path(tmp.name)

    gmsh.initialize()
    per_solid: list[dict] = []  # each: {vertices, faces, colour}

    try:
        gmsh.option.setNumber("General.Terminal", 0)
        gmsh.option.setNumber("General.Verbosity", 1)
        gmsh.option.setNumber("Geometry.OCCImportLabels", 1)

        gmsh.open(str(step_path))

        # Adaptive mesh sizing — compute the model's bounding-box
        # diagonal and scale char_length_max so a tiny bracket (~50mm)
        # gets ~1mm mesh but a car engine (~1m) coarsens to ~10mm+.
        # Prevents 45MB GLBs on the NIST test suite.
        if char_length_max is None:
            try:
                xmin, ymin, zmin, xmax, ymax, zmax = gmsh.model.getBoundingBox(-1, -1)
                diag = ((xmax - xmin) ** 2 + (ymax - ymin) ** 2 + (zmax - zmin) ** 2) ** 0.5
                # ~1% of diagonal, clamped to sensible bounds.
                char_length_max = max(0.5, min(30.0, diag * 0.01))
                logger.info(
                    "step_to_glb: diag=%.1fmm → char_length_max=%.2fmm",
                    diag, char_length_max,
                )
            except Exception:
                char_length_max = 2.0  # safe default when bbox unavailable
        gmsh.option.setNumber("Mesh.CharacteristicLengthMax", char_length_max)

        # Every 3D "solid" in the STEP file is a separate entity. We'll
        # mesh + extract each one individually so we can assign its own
        # colour and preserve part boundaries in the GLB.
        volumes = gmsh.model.getEntities(3)

        # Generate a full surface mesh once — gmsh will index triangles
        # by (dim, tag) so we can pull each solid's triangles separately.
        gmsh.model.mesh.generate(2)

        # If STEP had no true solids (rare — e.g. surface-only bodies),
        # fall back to meshing the whole model as one geometry.
        if not volumes:
            _emit_whole_model(per_solid)
        else:
            for solid_idx, (_dim, vol_tag) in enumerate(volumes):
                # Every solid's boundary is a set of 2D surfaces. Get them
                # via getBoundary; each is a (dim=2, tag=…) tuple.
                surfaces = gmsh.model.getBoundary(
                    [(3, vol_tag)], oriented=False, recursive=False
                )

                verts_list: list[tuple[float, float, float]] = []
                faces_list: list[tuple[int, int, int]] = []
                vertex_offset = 0

                for _sdim, surf_tag in surfaces:
                    node_tags, node_coords, _ = gmsh.model.mesh.getNodes(2, surf_tag, includeBoundary=True)
                    if len(node_tags) == 0:
                        continue
                    verts = np.asarray(node_coords, dtype=np.float32).reshape(-1, 3)
                    tag_to_local = {int(t): i for i, t in enumerate(node_tags)}

                    try:
                        _elem_tags, tri_node_tags = gmsh.model.mesh.getElementsByType(2, surf_tag)
                    except Exception:
                        continue
                    if len(tri_node_tags) == 0:
                        continue

                    # Remap global gmsh node tags → local per-surface indices,
                    # then offset into the accumulated solid buffer.
                    tri_local = np.fromiter(
                        (tag_to_local[int(t)] for t in tri_node_tags),
                        dtype=np.int64,
                        count=len(tri_node_tags),
                    ).reshape(-1, 3)

                    verts_list.extend((v[0], v[1], v[2]) for v in verts)
                    for tri in tri_local:
                        faces_list.append(
                            (
                                int(tri[0]) + vertex_offset,
                                int(tri[1]) + vertex_offset,
                                int(tri[2]) + vertex_offset,
                            )
                        )
                    vertex_offset += len(verts)

                if not verts_list or not faces_list:
                    continue

                # Pick a colour: STEP-parsed if available and long enough,
                # else the fallback palette (round-robin).
                if solid_idx < len(step_colours):
                    colour = step_colours[solid_idx]
                else:
                    colour = FALLBACK_PALETTE[solid_idx % len(FALLBACK_PALETTE)]

                per_solid.append(
                    {
                        "vertices": np.asarray(verts_list, dtype=np.float32),
                        "faces": np.asarray(faces_list, dtype=np.uint32),
                        "colour": colour,
                    }
                )

        # If per-solid extraction produced nothing (e.g. a STEP file with
        # surface-only bodies where `volumes` was populated but their
        # boundary surfaces contained no meshable triangles), fall back
        # to whole-model tessellation. This is what saves files like
        # `test-part.step` from returning "no geometry".
        if not per_solid:
            logger.info(
                "step_to_glb: per-solid extraction empty (%d volumes) — "
                "falling back to whole-model tessellation",
                len(volumes),
            )
            _emit_whole_model(per_solid)

        if not per_solid:
            raise ValueError(
                "STEP file contains no meshable geometry (checked "
                f"{len(volumes)} volumes + whole-model fallback)"
            )

        logger.info(
            "step_to_glb: %d solids, %d step-colours parsed",
            len(per_solid),
            len(step_colours),
        )
    finally:
        gmsh.finalize()
        try:
            step_path.unlink()
        except OSError:
            pass

    # Build a trimesh Scene with one geometry per solid, each with its
    # own PBR material (baseColorFactor). GLB packages these as separate
    # primitives so Babylon renders each solid with distinct colour.
    #
    # Why PBRMaterial with baseColorFactor instead of vertex colours:
    #   · Vertex colours trigger Babylon's RGBD/HDR environment-texture
    #     processing path, which fails with `Cannot read properties of
    #     null (reading 'program')` when no envMap is bound.
    #   · baseColorFactor is a plain uniform read by Babylon's
    #     PBRMaterial without any post-process/env-texture dependency.
    scene = trimesh.Scene()
    for i, solid in enumerate(per_solid):
        vertices: np.ndarray = solid["vertices"]
        faces: np.ndarray = solid["faces"]
        r, g, b = solid["colour"]

        # Pure-numpy vertex normals (trimesh's fix_normals pulls scipy
        # which is WDAC-blocked on this host).
        v0 = vertices[faces[:, 0]]
        v1 = vertices[faces[:, 1]]
        v2 = vertices[faces[:, 2]]
        face_normals = np.cross(v1 - v0, v2 - v0).astype(np.float32)
        vertex_normals = np.zeros_like(vertices)
        np.add.at(vertex_normals, faces[:, 0], face_normals)
        np.add.at(vertex_normals, faces[:, 1], face_normals)
        np.add.at(vertex_normals, faces[:, 2], face_normals)
        lengths = np.linalg.norm(vertex_normals, axis=1, keepdims=True)
        lengths[lengths == 0] = 1.0
        vertex_normals /= lengths

        # PBR material — baseColorFactor is a 4-tuple RGBA in linear
        # space, [0..1]. Metallic 0 + medium roughness gives a matte
        # plastic look typical of CAD viewers.
        material = trimesh.visual.material.PBRMaterial(
            name=f"solid_{i:02d}_mat",
            baseColorFactor=(r, g, b, 1.0),
            metallicFactor=0.05,
            roughnessFactor=0.55,
        )

        mesh = trimesh.Trimesh(
            vertices=vertices,
            faces=faces,
            vertex_normals=vertex_normals,
            visual=trimesh.visual.TextureVisuals(material=material),
            process=False,
        )
        scene.add_geometry(mesh, node_name=f"solid_{i:02d}")

    buf = io.BytesIO()
    scene.export(file_obj=buf, file_type="glb")
    return buf.getvalue()


def _emit_whole_model(per_solid: list[dict]) -> None:
    """Fallback path — no 3D solids in the STEP (surface-only body).
    Just take the whole tessellation as one grey geometry."""
    node_tags, node_coords, _ = gmsh.model.mesh.getNodes()
    if len(node_coords) == 0:
        return
    vertices = np.asarray(node_coords, dtype=np.float32).reshape(-1, 3)
    tag_to_index = {int(tag): i for i, tag in enumerate(node_tags)}

    _elem_tags, tri_node_tags = gmsh.model.mesh.getElementsByType(2)
    if len(tri_node_tags) == 0:
        return
    faces = np.fromiter(
        (tag_to_index[int(t)] for t in tri_node_tags),
        dtype=np.int64,
        count=len(tri_node_tags),
    ).reshape(-1, 3).astype(np.uint32)

    per_solid.append(
        {"vertices": vertices, "faces": faces, "colour": (0.7, 0.7, 0.72)}
    )
