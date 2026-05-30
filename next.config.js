/** @type {import('next').NextConfig} */
module.exports = {
  serverExternalPackages: ["ws"],
  webpack: (config, { isServer }) => {
    config.externals.push({ ws: "commonjs ws" })
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      }
    }
    return config
  },
}
