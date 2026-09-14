import type { MonkeyUserScript } from "vite-plugin-monkey";

const REPO = "https://github.com/wisnuwirayuda15/kick-extended";

// `releases/latest/download/<asset>` is a permanent GitHub redirect to that
// asset on whatever the newest release happens to be, so these two URLs never
// need updating when a version ships.
const LATEST = `${REPO}/releases/latest/download`;

// The ==UserScript== block is configuration, not a comment: it is what the
// userscript manager reads to decide permissions, matches, CDN requires and
// where to look for updates. vite-plugin-monkey regenerates it every build.
export const userscript: MonkeyUserScript = {
  name: "Kick Extended",
  namespace: REPO,
  // Overridden at build time from the git tag; see vite.config.ts.
  version: "2.0.0",
  description:
    "Unlock subscriber-only VODs, a custom HLS player with keyboard shortcuts and quality control, chat replay, external player handoff, and video downloads on Kick.",
  author: "Wisnu Wirayuda",
  match: ["*://kick.com/*", "*://www.kick.com/*"],
  icon: "https://kick.com/favicon.ico",
  homepageURL: REPO,
  supportURL: `${REPO}/issues`,
  // Auto-update. The manager polls updateURL, which serves only the header, and
  // fetches downloadURL when the @version there is higher than the installed
  // one. Both must be absolute and reachable without authentication, which is
  // why the repository has to be public.
  downloadURL: `${LATEST}/KickExtended.user.js`,
  updateURL: `${LATEST}/KickExtended.meta.js`,
  // Declared explicitly even though the plugin also auto-collects grants from
  // the bundle: GM_setClipboard has two call sites and GM_info one, which is
  // exactly the pattern that goes missing when only auto-collection is trusted.
  grant: ["GM_xmlhttpRequest", "GM_addStyle", "GM_setClipboard", "GM_info"],
  connect: ["kick.com", "web.kick.com", "stream.kick.com"],
  "run-at": "document-idle",
};
