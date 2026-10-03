import type { NextConfig } from 'next';

// Backend (NestJS) ka address. Production me env variable se aayega.
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
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
