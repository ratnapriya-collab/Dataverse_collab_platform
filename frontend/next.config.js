/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Never ship source maps in production — protects the bundled in-house viewer
  // from trivial reverse-engineering. (Minification + mangling still happens.)
  productionBrowserSourceMaps: false,

  webpack: (config, { isServer }) => {
    // The viewer + opencascade.js need: WASM, Web Workers, and Node built-in
    // shims (fs / perf_hooks / os / crypto / stream) replaced with empty stubs
    // for browser builds. This mirrors the Vite alias setup in the viewer repo.
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    }

    if (!isServer) {
      config.resolve = config.resolve || {}
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        perf_hooks: false,
        os: false,
        worker_threads: false,
        crypto: false,
        stream: false,
        path: false,
      }
    }

    // Tell webpack to handle .wasm files as async modules.
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    })

    return config
  },

  // opencascade.js is huge and runtime-only — never SSR it.
  transpilePackages: ['@babylonjs/core', '@babylonjs/loaders', '@babylonjs/materials'],
}

module.exports = nextConfig
