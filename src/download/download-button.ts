import { DOWNLOAD_BUTTON_ID } from "../constants.ts";
import { isVodPage } from "../native/detect.ts";
import { buildDownloadUrl } from "./download-url.ts";
import { createDownloadIcon } from "./icon.ts";

// Reported, not changed: this scans every `button span` on the page, and the
// observer calls it on every DOM mutation. On a VOD page with live chat that
// is a lot of nodes re-scanned very often, and it is the biggest cost in the
// merged script. Matching on the text "Subscribe" also breaks whenever Kick's
// UI is not in English. Both are pre-existing behaviour and are left alone so
// the migration stays a migration.
function findSubscribeButton() {
  const spans = document.querySelectorAll("button span");
  for (const span of spans) {
    if (span.textContent.trim() === "Subscribe") {
      return span.closest("button");
    }
  }
  return null;
}

function createDownloadButton(referenceButton) {
  const button = document.createElement("button");
  button.id = DOWNLOAD_BUTTON_ID;

  // Copy classes from the Subscribe button so it blends with Kick's UI
  button.className = referenceButton.className;
  button.style.marginLeft = "8px";

  // Download icon (SVG, left of the text)
  button.appendChild(createDownloadIcon());

  const label = document.createElement("span");
  label.textContent = "Download";
  label.style.marginLeft = "6px";
  button.appendChild(label);

  // Make sure icon + text align nicely regardless of Kick's button styles
  button.style.display = "inline-flex";
  button.style.alignItems = "center";

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.open(buildDownloadUrl(window.location.href), "_blank", "noopener");
  });

  return button;
}

export function injectDownloadButton() {
  if (!isVodPage()) {
    // Clean up if user navigated away (SPA navigation)
    document.getElementById(DOWNLOAD_BUTTON_ID)?.remove();
    return;
  }

  if (document.getElementById(DOWNLOAD_BUTTON_ID)) return; // already injected

  const subscribeButton = findSubscribeButton();
  if (!subscribeButton) return;

  const downloadButton = createDownloadButton(subscribeButton);
  subscribeButton.insertAdjacentElement("afterend", downloadButton);
}
