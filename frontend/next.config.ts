import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {},
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_WS_URL:  process.env.NEXT_PUBLIC_WS_URL  || 'ws://localhost:8000/ws',
  },
  // Allow CORS image fetching if needed later
  images: {
    domains: ['localhost'],
  },
}

export default nextConfig
