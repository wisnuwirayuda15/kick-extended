import css from "./styles.css?raw";
import {
  SUBSCRIBER_ONLY_SELECTOR,
  SUBSCRIBER_OVERLAY_CONTAINER_SELECTOR,
} from "./constants.ts";
import { state } from "./state.ts";
import { ensureCopyUrlButton } from "./native/copy-url-button.ts";
import { unlockVideo } from "./player/mount.ts";
import { ensureCustomPlayerToggle } from "./native/switch-button.ts";
import { injectDownloadButton } from "./download/download-button.ts";
import { injectThumbnailButtons } from "./download/thumbnail-buttons.ts";

console.log(`Kick Extended: userscript loaded (v${GM_info.script.version})`);

GM_addStyle(css);

// A <video> that React detaches from the DOM keeps decoding audio, and
// hls.js keeps feeding it, so an SPA navigation has to tear this down by
// hand rather than relying on the element going away.
function destroyCustomPlayer() {
  if (state.activeHls) {
    try {
      state.activeHls.destroy();
    } catch (e) {
      /* already gone */
    }
    state.activeHls = null;
  }

  if (state.activeChatController) {
    try {
      state.activeChatController.stop();
    } catch (e) {
      /* already gone */
    }
    state.activeChatController = null;
  }

  const customVideo =
    state.activePlayerUi?.vid || document.querySelector("#k-video");
  if (customVideo) {
    try {
      customVideo.pause();
      customVideo.removeAttribute("src");
      customVideo.srcObject = null;
      customVideo.load();
    } catch (e) {
      /* already gone */
    }
    customVideo.remove();
  }

  document.querySelectorAll("#k-player").forEach((el) => el.remove());
  document.querySelector("#k-toast")?.remove();
  document.querySelector("#k-copy-url-btn")?.remove();
  document
    .querySelectorAll("[data-kick-unlocker-processing]")
    .forEach((el) => delete (el as any).dataset.kickUnlockerProcessing);

  clearTimeout(state.autoSwitchTimer);
  state.autoSwitchTimer = null;
  state.nativeExternalCache = null;
  state.activePlayerUi = null;
  state.isUnlocking = false;
}

let lastHref = window.location.href;

function handleLocationChange() {
  if (window.location.href === lastHref) return;
  lastHref = window.location.href;
  destroyCustomPlayer();
}

function runDownloadInjections() {
  injectDownloadButton();
  injectThumbnailButtons();
}

// Kick routes client-side, so there is no navigation event to hook. Patch
// the history methods and cover the back/forward button separately.
//
// One patch, one callback list. Both merged scripts patched these same two
// methods; patching a global twice is fragile and makes load order matter.
// The two original timings are preserved rather than merged into one: the
// player tears down synchronously, the download buttons re-inject after the
// same 100ms delay the downloader always used.
const navigationCallbacks = [
  handleLocationChange,
  () => setTimeout(runDownloadInjections, 100),
];

function onNavigate() {
  navigationCallbacks.forEach((callback) => callback());
}

["pushState", "replaceState"].forEach((method) => {
  const original = history[method];
  history[method] = function (...args) {
    const returned = original.apply(this, args);
    onNavigate();
    return returned;
  };
});
window.addEventListener("popstate", onNavigate);
window.addEventListener("hashchange", handleLocationChange);
window.addEventListener("pagehide", destroyCustomPlayer);

const observer = new MutationObserver(() => {
  handleLocationChange();

  // React can rip our player out without any navigation event firing.
  if (state.activePlayerUi?.vid && !state.activePlayerUi.vid.isConnected) {
    destroyCustomPlayer();
  }

  const subscriberOverlay = document.querySelector(SUBSCRIBER_ONLY_SELECTOR);

  ensureCopyUrlButton();

  if (subscriberOverlay) {
    const outerContainer = subscriberOverlay.closest(
      SUBSCRIBER_OVERLAY_CONTAINER_SELECTOR,
    );
    if (
      outerContainer &&
      !(outerContainer as any).dataset.kickUnlockerProcessing &&
      !state.isUnlocking
    ) {
      unlockVideo(subscriberOverlay);
    }
  } else {
    // Skipped while the subscriber-only overlay is up. This was an early
    // return before the merge; it is an else branch now so that the download
    // injectors below still run in that case, as they did when the downloader
    // had an observer of its own.
    ensureCustomPlayerToggle();
  }

  runDownloadInjections();
});
observer.observe(document.body, { childList: true, subtree: true });
ensureCustomPlayerToggle();
runDownloadInjections();
