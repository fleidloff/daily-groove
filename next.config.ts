import type { NextConfig } from "next";

const PAGE_EXTENSIONS = ["tsx", "ts", "jsx", "js"];

// A page.dev.tsx is a route under `next dev` and not a file Next recognises
// as a page in a production build.
export function pageExtensionsFor(env: string): string[] {
  return env === "development"
    ? [...PAGE_EXTENSIONS, "dev.tsx"]
    : [...PAGE_EXTENSIONS];
}

const nextConfig: NextConfig = {
  pageExtensions: pageExtensionsFor(process.env.NODE_ENV ?? ""),
  // Pin the workspace root: a stray package-lock.json in the home directory
  // otherwise makes Turbopack infer the wrong project root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
