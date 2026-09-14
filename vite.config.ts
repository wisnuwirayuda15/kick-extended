import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";
import { userscript } from "./src/meta.ts";

// CI sets this from the git tag (v2.0.1 -> 2.0.1) so a release can never ship
// with a stale @version, which would leave every installed copy un-updated.
// Local builds fall back to the literal in src/meta.ts.
const version = process.env.USERSCRIPT_VERSION || userscript.version;

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
      userscript: { ...userscript, version },
      build: {
        fileName: "KickExtended.user.js",
        // Header-only companion file. The manager polls this for the version
        // instead of downloading the whole script on every check.
        metaFileName: "KickExtended.meta.js",
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
