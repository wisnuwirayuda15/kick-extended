import { resolveStream } from "../lib/kick-api.ts";
import { state } from "../state.ts";
import { findCopyButtonAnchor, isVodPage } from "./detect.ts";

export function ensureCopyUrlButton() {
  // Needs a video slug to resolve a stream, so channel pages are out.
  if (!isVodPage()) return;
  if (document.querySelector("#k-copy-url-btn")) return;

  const anchor = findCopyButtonAnchor();
  if (!anchor?.parentElement) return;

  const button = document.createElement("button");
  button.id = "k-copy-url-btn";
  button.type = "button";
  button.title = "Copy stream URL (.m3u8)";
  const defaultLabel = "Copy stream URL";
  const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  button.innerHTML = `${icon}<span>${defaultLabel}</span>`;

  const setLabel = (text, state) => {
    button.querySelector("span").textContent = text;
    if (state) button.dataset.state = state;
    else delete button.dataset.state;
  };

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.busy === "1") return;

    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const channelSlug = pathParts[0];
    const videoSlug = pathParts[2];
    const cacheKey = `${channelSlug}/${videoSlug}`;

    if (state.nativeExternalCache?.key !== cacheKey) {
      button.dataset.busy = "1";
      setLabel("Loading...", null);
      const resolved = await resolveStream(channelSlug, videoSlug);
      delete button.dataset.busy;

      if (!resolved) {
        setLabel("Stream not found", "error");
        setTimeout(() => setLabel(defaultLabel, null), 2500);
        return;
      }
      state.nativeExternalCache = { key: cacheKey, ...resolved };
    }

    GM_setClipboard(state.nativeExternalCache.streamUrl, "text");
    setLabel("Copied", "done");
    setTimeout(() => setLabel(defaultLabel, null), 1600);
  });

  anchor.parentElement.insertBefore(button, anchor.nextSibling);
}
