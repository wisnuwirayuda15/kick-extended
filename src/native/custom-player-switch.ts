import {
  CONTROL_ANCHOR_SELECTOR,
  SUBSCRIBER_ONLY_SELECTOR,
} from "../constants.ts";
import { icon } from "../icons.ts";
import { resolveStream } from "../lib/kick-api.ts";
import { addMenuCommand } from "../lib/menu.ts";
import {
  isCustomPlayerEnabled,
  setCustomPlayerEnabled,
} from "../lib/storage.ts";
import { showToast } from "../lib/toast.ts";
import {
  buildExternalTargets,
  makeVideoTitle,
  populateExternalMenu,
} from "../player/external.ts";
import { unlockVideo } from "../player/mount.ts";
import { state } from "../state.ts";
import {
  findNativePlayerContainer,
  isNativePlayerVisible,
  isVodPage,
} from "./detect.ts";
import { getVodSlugs } from "../lib/vod-slugs.ts";

// Every VOD plays in the custom player unless the user turns it off from the
// userscript manager's menu. Subscriber-only VODs are unlocked either way,
// from main.ts: Kick's player cannot play those at all.

export function ensureCustomPlayer() {
  if (!isVodPage() || state.isUnlocking) return;
  // Sub-only pages are handled automatically by the observer in main.ts.
  if (document.querySelector(SUBSCRIBER_ONLY_SELECTOR)) return;

  if (!isCustomPlayerEnabled()) {
    ensureNativeExternalButton();
    return;
  }

  const { channelSlug, videoSlug, cacheKey } = getVodSlugs();
  if (state.customPlayerFailedKey === cacheKey) {
    ensureNativeExternalButton();
    return;
  }

  // Start resolving before Kick's player has even rendered, so the switch
  // below is not held up by the network once it is visible. Once per VOD:
  // this runs on every mutation, and a failed resolve must not be retried
  // on each of them.
  if (state.prefetchedKey !== cacheKey) {
    state.prefetchedKey = cacheKey;
    resolveStream(channelSlug, videoSlug);
  }

  const container: any = findNativePlayerContainer();
  if (!container || container.dataset.kickUnlockerProcessing) return;
  if (!isNativePlayerVisible()) return;

  unlockVideo(null, { explicitContainer: container, replaceNative: true });
}

export function registerCustomPlayerMenuCommand() {
  addMenuCommand({
    label: () =>
      isCustomPlayerEnabled()
        ? "Custom player: on (click to turn off)"
        : "Custom player: off (click to turn on)",
    run: () => {
      const enabled = !isCustomPlayerEnabled();
      setCustomPlayerEnabled(enabled);

      if (enabled) {
        showToast("Kick Extended: custom player on.");
        ensureCustomPlayer();
        return;
      }

      showToast(
        "Kick Extended: custom player off. Subscriber-only VODs still use it.",
      );
      // Kick mounts its player during page bootstrap, so a reload is the only
      // reliable way to get it back. A sub-only VOD keeps the custom player.
      if (state.activePlayerUi?.replacedNative) window.location.reload();
    },
  });
}

/** External-player menu in Kick's own control bar, for when it is in use. */
function ensureNativeExternalButton() {
  const anchorButton = document.querySelector(CONTROL_ANCHOR_SELECTOR);
  if (!anchorButton || !anchorButton.parentElement) return;
  if (anchorButton.parentElement.querySelector("#k-native-ext-wrap")) return;

  const wrap = document.createElement("div");
  wrap.id = "k-native-ext-wrap";
  wrap.className = "k-ext-wrap";

  const button = document.createElement("button");
  button.type = "button";
  button.title = "Open in external player";
  button.setAttribute("aria-label", "Open in external player");
  // Borrow the sibling's classes so it inherits Kick's sizing, hover and
  // focus treatment instead of being styled from scratch.
  button.className = anchorButton.className;
  button.innerHTML = icon("external", 'class="inline-block shrink-0"');

  const menu = document.createElement("div");
  menu.className = "k-ext-menu";

  const closeMenu = () => wrap.classList.remove("open");

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (wrap.classList.contains("open")) {
      closeMenu();
      return;
    }

    const { channelSlug, videoSlug, cacheKey } = getVodSlugs();

    wrap.classList.add("open");

    if (state.nativeExternalCache?.key !== cacheKey) {
      menu.innerHTML = `<div class="k-ext-heading">Resolving stream URL…</div>`;
      const resolved = await resolveStream(channelSlug, videoSlug);
      if (!resolved) {
        menu.innerHTML = `<div class="k-ext-heading">Stream not found</div>`;
        return;
      }
      state.nativeExternalCache = { key: cacheKey, ...resolved };
    }

    populateExternalMenu(
      menu,
      buildExternalTargets(
        state.nativeExternalCache.streamUrl,
        makeVideoTitle(state.nativeExternalCache.result),
      ),
      closeMenu,
    );
  });

  document.addEventListener("click", (event) => {
    if (wrap.isConnected && !wrap.contains(event.target as Node)) closeMenu();
  });

  wrap.appendChild(button);
  wrap.appendChild(menu);
  anchorButton.parentElement.insertBefore(wrap, anchorButton);
}
