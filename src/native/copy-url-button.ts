import { ICONS } from "../icons.ts";
import { resolveStream } from "../lib/kick-api.ts";
import { state } from "../state.ts";
import { findCopyButtonAnchor, isVodPage } from "./detect.ts";
import { getVodSlugs } from "../lib/vod-slugs.ts";

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
  button.innerHTML = `${ICONS.copy}<span>${defaultLabel}</span>`;

  const setLabel = (text, state) => {
    button.querySelector("span").textContent = text;
    if (state) button.dataset.state = state;
    else delete button.dataset.state;
  };

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.busy === "1") return;

    const { channelSlug, videoSlug, cacheKey } = getVodSlugs();

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
