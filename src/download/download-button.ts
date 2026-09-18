import { DOWNLOAD_BUTTON_ID } from "../constants.ts";
import { isVodPage } from "../native/detect.ts";
import { state } from "../state.ts";
import { openDownloadDialog } from "./download-dialog.ts";
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
  label.className = "k-dl-btn-label";
  label.textContent = "Download";
  label.style.marginLeft = "6px";
  button.appendChild(label);

  // Make sure icon + text align nicely regardless of Kick's button styles
  button.style.display = "inline-flex";
  button.style.alignItems = "center";

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openDownloadDialog();
  });

  return button;
}

export function injectDownloadButton() {
  if (!isVodPage()) {
    // Clean up if user navigated away (SPA navigation)
    document.getElementById(DOWNLOAD_BUTTON_ID)?.remove();
    return;
  }

  const existing = document.getElementById(DOWNLOAD_BUTTON_ID);
  if (existing) {
    syncDownloadButtonState(existing);
    return;
  }

  const subscribeButton = findSubscribeButton();
  if (!subscribeButton) return;

  const downloadButton = createDownloadButton(subscribeButton);
  subscribeButton.insertAdjacentElement("afterend", downloadButton);
}

/**
 * Reflects whether a download is already running.
 *
 * One at a time: a second pool would double the memory bound and halve both
 * downloads' throughput. This is called from the MutationObserver, which on a
 * live VOD page fires constantly, so it compares against the last rendered
 * state and touches the DOM only when that actually changed.
 */
function syncDownloadButtonState(button: any) {
  const next = state.activeDownload ? "busy" : "idle";
  if (button.dataset.dlState === next) return;
  button.dataset.dlState = next;

  const busy = next === "busy";
  button.disabled = busy;
  button.style.opacity = busy ? "0.6" : "";
  const label = button.querySelector(".k-dl-btn-label");
  if (label) label.textContent = busy ? "Downloading…" : "Download";
}
