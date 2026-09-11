import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";
import { userscript } from "./src/meta.ts";

export default defineConfig({
  build: {
    // Unminified on purpose: the built userscript is committed, and keeping it
    // readable means the output can be grepped and diffed between commits to
    // prove a refactor changed nothing.
    minify: false,
  },
  plugins: [
    monkey({
      entry: "src/main.ts",
      userscript,
      build: {
        fileName: "KickExtended.user.js",
        // A literal URL rather than a cdn.* helper, so the emitted @require is
        // byte-identical to the one the original script shipped with.
        externalGlobals: {
          "hls.js": [
            "Hls",
            "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js",
          ],
        },
      },
    }),
  ],
});
