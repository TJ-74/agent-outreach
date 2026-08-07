import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin Turbopack's root so a stray package.json/lockfile in a parent
// directory (e.g. C:\Users\tjana) doesn't become the workspace root and
// break bare CSS imports like `@import "tailwindcss"`.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
  async rewrites() {
    return [
      {
        source: "/agent/:path*",
        destination: "http://localhost:8000/agent/:path*",
      },
    ];
  },
};

export default nextConfig;
