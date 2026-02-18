/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: { unoptimized: true },
  compiler: {
    removeConsole: {
      exclude: ['warn'],
    },
  },
};

module.exports = nextConfig;