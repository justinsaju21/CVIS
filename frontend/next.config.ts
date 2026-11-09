import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {},
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_WS_URL:  process.env.NEXT_PUBLIC_WS_URL  || 'ws://localhost:8000/ws',
  },
  // Allow CORS image fetching if needed later
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/ppt',
        destination: '/showcase/ppt',
        permanent: true,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/Showcase',
        destination: '/showcase',
      },
      {
        source: '/Showcase/ppt',
        destination: '/showcase/ppt',
      },
    ]
  },
}

export default nextConfig
