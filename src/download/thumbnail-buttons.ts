import {
  THUMB_DOWNLOAD_BUTTON_CLASS,
  THUMB_INJECTED_FLAG,
  VOD_PATH_REGEX,
} from "../constants.ts";
import { buildDownloadUrl } from "./download-url.ts";
import { createDownloadIcon } from "./icon.ts";

export function injectThumbnailButtons() {
  // if (!isVideosListPage()) return;

  // Video thumbnails are <a href="/{user}/videos/{id}"> cards
  const anchors = document.querySelectorAll('a[href*="/videos/"]');
  for (const anchor of anchors as any) {
    if (anchor.dataset[THUMB_INJECTED_FLAG]) continue;

    const href = anchor.getAttribute("href");
    if (!href || !VOD_PATH_REGEX.test(href)) continue;

    // Only target thumbnail cards (they contain the video thumbnail image)
    if (!anchor.querySelector("img[data-thumbnail], img")) continue;

    anchor.dataset[THUMB_INJECTED_FLAG] = "true";

    const button = document.createElement("button");
    button.className = THUMB_DOWNLOAD_BUTTON_CLASS;
    button.title = "Download video";
    button.appendChild(createDownloadIcon());

    const videoUrl = new URL(href, window.location.origin).href;
    button.addEventListener("click", (event) => {
      // Stop the click from triggering the anchor navigation
      event.preventDefault();
      event.stopPropagation();
      window.open(buildDownloadUrl(videoUrl), "_blank", "noopener");
    });

    anchor.appendChild(button);
  }
}
