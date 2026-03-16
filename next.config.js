const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Exclude large non-runtime files from serverless function bundles ──
  // These are either CDN-served (public/), pipeline data (lib/wqp/), or build artifacts.
  // Without this, Vercel traces ~400 MB into each function, exceeding the 250 MB limit.
  outputFileTracingExcludes: {
    '*': [
      './lib/wqp/**',             // 258 MB — Python pipeline data, not used at runtime
      './public/images/heroes/**', // 49 MB  — hero banner images, served by CDN
      './public/*.png',            // ~40 MB — marketing images, served by CDN
      './public/*.PNG',
      './public/*.jpg',
      './public/*.JPG',
      './export/**',               // 6 MB   — codebase text exports
      './scripts/**',              // build scripts
      './pin-pipeline/**',         // Python pipeline
      './tsconfig.tsbuildinfo',
      './package-lock.json',
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  compiler: {
    removeConsole: {
      exclude: ['warn', 'error'],
    },
  },
  turbopack: {
    resolveAlias: {
      fs: { browser: './lib/stubs/empty.js' },
      path: { browser: './lib/stubs/empty.js' },
    },
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'X-DNS-Prefetch-Control', value: 'off' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ],
    }];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { fs: false };
    }
    return config;
  },
};

module.exports = withSentryConfig(withBundleAnalyzer(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  hideSourceMaps: true,
  automaticVercelMonitors: true,
});
