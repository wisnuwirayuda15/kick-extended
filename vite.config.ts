import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";
import { userscript } from "./src/meta.ts";

export default defineConfig({
  build: {
    // Container queries (@container / container-type: inline-size) are
    // load-bearing in styles.css. A low CSS target makes lightningcss
    // downlevel or strip them, so keep this high.
    cssTarget: "chrome111",
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
