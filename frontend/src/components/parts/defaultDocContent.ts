/**
 * Default content shown in the Doc editor when a tab has never been edited.
 *
 * Behaviour:
 *   · First time the user opens a part's Doc tab → this article is rendered.
 *   · They can edit, delete, or replace it — every keystroke autosaves to
 *     localStorage. The next visit shows their edits, not this default.
 *   · If they wipe their saved content back to truly empty (rare — usually
 *     leaves a stray <br> behind), the default returns on next open.
 *
 * Applied uniformly across ALL parts × ALL tabs, per the product request to
 * never show an empty editor canvas on first open.
 *
 * Plain HTML so it round-trips through `node.innerHTML = …` cleanly. No
 * external CSS dependencies — the editor's existing typography rules
 * style h1/h2/h3/p/ul/li, so we just emit semantic tags.
 */

export const DEFAULT_DOC_HTML = `
<h1>AI and 3D Engineering Drawings: Transforming Modern Engineering Design</h1>

<h2>Introduction</h2>
<p>
  Artificial Intelligence (AI) and 3D Engineering Drawings have become two of
  the most influential technologies in modern engineering. The integration of
  AI into Computer-Aided Design (CAD) and 3D modeling has revolutionized the
  way engineers design, analyze, manufacture, and maintain products. Traditional
  engineering drawings were created manually, requiring significant time,
  effort, and expertise. Today, AI-powered tools can automate design processes,
  optimize models, detect errors, and improve overall productivity.
</p>
<p>
  The combination of AI and 3D engineering drawings is transforming industries
  such as mechanical engineering, civil engineering, aerospace, automotive,
  architecture, manufacturing, and construction. Engineers can now create
  highly accurate digital models, simulate real-world conditions, and generate
  intelligent design recommendations, leading to faster development cycles and
  improved product quality.
</p>

<h2>What are 3D Engineering Drawings?</h2>
<p>
  3D engineering drawings are digital representations of physical objects that
  provide detailed information about dimensions, geometry, materials,
  tolerances, and manufacturing requirements. Unlike traditional 2D drawings,
  3D models offer a complete visualization of components and assemblies from
  multiple perspectives.
</p>

<h3>Key Features of 3D Engineering Drawings</h3>
<ul>
  <li>Accurate geometric representation</li>
  <li>Parametric modeling capabilities</li>
  <li>Real-time modifications and updates</li>
  <li>Assembly visualization</li>
  <li>Material specifications</li>
  <li>Manufacturing information</li>
  <li>Dimensioning and tolerancing</li>
  <li>Simulation and analysis support</li>
</ul>

<h3>Common Software Used</h3>
<ul>
  <li>AutoCAD</li>
  <li>SolidWorks</li>
  <li>CATIA</li>
  <li>PTC Creo</li>
  <li>Siemens NX</li>
  <li>Fusion 360</li>
</ul>
<p>
  These tools enable engineers to create detailed 3D models that can be used
  throughout the product lifecycle.
</p>

<h2>Role of Artificial Intelligence in Engineering Design</h2>
<p>
  Artificial Intelligence refers to computer systems capable of performing
  tasks that normally require human intelligence, such as learning, reasoning,
  decision-making, and problem-solving.
</p>
<p>
  In engineering design, AI helps automate repetitive tasks, improve design
  accuracy, and generate innovative solutions that may not be immediately
  apparent to human designers.
</p>

<h3>Core AI Technologies Used</h3>

<h4>Machine Learning (ML)</h4>
<p>
  Machine learning algorithms learn from historical design data and improve
  their performance over time.
</p>

<h4>Deep Learning</h4>
<p>
  Deep learning models analyze complex patterns in engineering datasets and
  provide intelligent predictions.
</p>

<h4>Computer Vision</h4>
<p>
  Computer vision enables AI systems to interpret engineering drawings,
  recognize features, and detect defects.
</p>

<h4>Natural Language Processing (NLP)</h4>
<p>
  NLP allows engineers to interact with CAD systems using voice commands and
  text-based instructions.
</p>

<h4>Generative AI</h4>
<p>
  Generative AI can automatically create multiple design alternatives based on
  specified requirements and constraints.
</p>

<h2>Applications of AI in 3D Engineering Drawings</h2>

<h3>1. Automated Design Generation</h3>
<p>
  AI can generate multiple design concepts automatically based on predefined
  constraints such as:
</p>
<ul>
  <li>Weight</li>
  <li>Material</li>
  <li>Cost</li>
  <li>Strength</li>
  <li>Manufacturing process</li>
</ul>
<p>This approach is known as <strong>Generative Design</strong>.</p>

<h4>Benefits</h4>
<ul>
  <li>Faster design development</li>
  <li>Reduced engineering effort</li>
  <li>Innovative solutions</li>
  <li>Improved optimization</li>
</ul>
<p>
  For example, an engineer designing an aircraft bracket can use AI to generate
  hundreds of lightweight alternatives while maintaining structural integrity.
</p>

<h3>2. Intelligent Error Detection</h3>
<p>
  One of the major challenges in engineering drawings is identifying design
  errors before manufacturing.
</p>
<p>AI can automatically detect:</p>
<ul>
  <li>Missing dimensions</li>
  <li>Geometric conflicts</li>
  <li>Assembly interferences</li>
  <li>Tolerance violations</li>
  <li>Manufacturing constraints</li>
</ul>

<h4>Example</h4>
<p>
  If two components overlap in an assembly, AI can identify the collision and
  suggest corrections before production begins.
</p>

<h3>3. Design Optimization</h3>
<p>
  AI algorithms analyze thousands of design possibilities and identify the most
  efficient solution.
</p>
<p>Optimization factors include:</p>
<ul>
  <li>Weight reduction</li>
  <li>Cost reduction</li>
  <li>Material efficiency</li>
  <li>Structural performance</li>
  <li>Thermal performance</li>
  <li>Energy efficiency</li>
</ul>
<p>This leads to better-performing products with lower production costs.</p>

<h3>4. Predictive Engineering Analysis</h3>
<p>AI can predict the behavior of components under various operating conditions.</p>

<h4>Analysis Areas</h4>
<ul>
  <li>Stress analysis</li>
  <li>Thermal analysis</li>
  <li>Fatigue prediction</li>
  <li>Fluid flow analysis</li>
  <li>Vibration analysis</li>
</ul>
<p>Engineers can identify potential failures early and make necessary modifications.</p>

<h3>5. Automatic Drawing Creation</h3>
<p>Traditionally, engineers manually created 2D drawings from 3D models.</p>
<p>AI now helps automate:</p>
<ul>
  <li>View generation</li>
  <li>Section creation</li>
  <li>Dimension placement</li>
  <li>Annotation generation</li>
  <li>Bill of Materials (BOM) creation</li>
</ul>
<p>This significantly reduces documentation time.</p>

<h3>6. Quality Inspection and Defect Detection</h3>
<p>AI-powered computer vision systems compare manufactured parts with original 3D models.</p>
<p>The system can identify:</p>
<ul>
  <li>Surface defects</li>
  <li>Dimensional inaccuracies</li>
  <li>Cracks</li>
  <li>Missing features</li>
  <li>Assembly defects</li>
</ul>
<p>This improves product quality and reduces rejection rates.</p>

<h2>AI in Mechanical Engineering Drawings</h2>
<p>Mechanical engineers use AI to enhance product design and manufacturing processes.</p>

<h3>Applications</h3>
<ul>
  <li>Gear design optimization</li>
  <li>Machine component design</li>
  <li>Sheet metal design</li>
  <li>Assembly validation</li>
  <li>Manufacturing planning</li>
</ul>

<h4>Example</h4>
<p>
  AI can optimize a gearbox housing by reducing material usage while
  maintaining required strength levels.
</p>
`
