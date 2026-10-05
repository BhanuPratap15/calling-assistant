import path from 'node:path';
import type { NextConfig } from 'next';

// Backend (NestJS) ka address. Production me env variable se aayega.
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // Production Docker image: sirf zaroori files (.next/standalone) — node_modules ka poora folder nahi
  output: 'standalone',
  // Monorepo: dependencies root node_modules me hain → tracing root = repo root
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  poweredByHeader: false, // "X-Powered-By: Next.js" header mat bhejo
  /**
   * Browser `/api/...` call karta hai (same origin: localhost:3000)
   * → Next.js usko chupchaap backend (localhost:4000/api/...) pe bhej deta hai.
   * Fayda: CORS ki tension nahi, aur login cookie "first-party" rehti hai.
   */
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
