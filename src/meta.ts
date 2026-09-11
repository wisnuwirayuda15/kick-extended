import type { MonkeyUserScript } from "vite-plugin-monkey";

// The ==UserScript== block is configuration, not a comment: it is what the
// userscript manager reads to decide permissions, matches and CDN requires.
// vite-plugin-monkey regenerates it from this object on every build.
export const userscript: MonkeyUserScript = {
  name: "Kick Extended",
  namespace: "https://github.com/wisnuwirayuda15/kick-extended",
  version: "2.0.0",
  description:
    "Unlock subscriber-only VODs, a custom HLS player with keyboard shortcuts and quality control, chat replay, external player handoff, and video downloads on Kick.",
  author: "Wisnu Wirayuda",
  match: ["*://kick.com/*", "*://www.kick.com/*"],
  icon: "https://kick.com/favicon.ico",
  // Declared explicitly even though the plugin also auto-collects grants from
  // the bundle: GM_setClipboard has two call sites and GM_info one, which is
  // exactly the pattern that goes missing when only auto-collection is trusted.
  grant: ["GM_xmlhttpRequest", "GM_addStyle", "GM_setClipboard", "GM_info"],
  connect: ["kick.com", "web.kick.com", "stream.kick.com", "api.github.com"],
  "run-at": "document-idle",
};
