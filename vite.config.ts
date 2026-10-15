// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // On Vercel, build for Vercel's Node runtime (also lets SMTP email connect).
  // On Render (Web Service), build a Node server: start with `npm start` (node .output/server/index.mjs).
  ...(process.env["VERCEL"]
    ? { nitro: { preset: "vercel" } }
    : process.env["RENDER"] || process.env["NODE_SERVER"]
      ? { nitro: { preset: "node-server" } }
      : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
