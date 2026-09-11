import {
  AUTO_SWITCH_SETTLE_MS,
  CONTROL_ANCHOR_SELECTOR,
  SUBSCRIBER_ONLY_SELECTOR,
} from "../constants.ts";
import { resolveStream } from "../lib/kick-api.ts";
import { getPreferCustom, setPreferCustom } from "../lib/storage.ts";
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
  isNativePlayerReady,
  isVodPage,
} from "./detect.ts";

export function ensureCustomPlayerToggle() {
  if (!isVodPage() || state.isUnlocking) return;
  // Sub-only pages are handled automatically by the observer below.
  if (document.querySelector(SUBSCRIBER_ONLY_SELECTOR)) return;

  const container: any = findNativePlayerContainer();
  if (!container || container.dataset.kickUnlockerProcessing) return;

  const switchToCustom = () =>
    unlockVideo(null, { explicitContainer: container, manualSwitch: true });

  if (getPreferCustom()) {
    if (state.autoSwitchTimer || !isNativePlayerReady()) return;
    // Let React finish its mount pass before we tear the container down.
    // Re-check afterwards in case the DOM moved during the wait.
    state.autoSwitchTimer = setTimeout(() => {
      state.autoSwitchTimer = null;
      if (state.isUnlocking || !isNativePlayerReady()) return;
      const readyContainer: any = findNativePlayerContainer();
      if (!readyContainer || readyContainer.dataset.kickUnlockerProcessing)
        return;
      showToast(
        "KickNoSub: otomatis pindah ke custom player. Pakai tombol swap di control bar buat balik ke player Kick.",
        6000,
      );
      unlockVideo(null, {
        explicitContainer: readyContainer,
        manualSwitch: true,
      });
    }, AUTO_SWITCH_SETTLE_MS);
    return;
  }

  const anchorButton = document.querySelector(CONTROL_ANCHOR_SELECTOR);
  if (!anchorButton || !anchorButton.parentElement) return;
  if (anchorButton.parentElement.querySelector("#k-switch-btn")) return;

  const switchButton = document.createElement("button");
  switchButton.id = "k-switch-btn";
  switchButton.type = "button";
  switchButton.dataset.kickNosub = "true";
  switchButton.title = "Ganti ke player KickNoSub";
  switchButton.setAttribute("aria-label", "Ganti ke player KickNoSub");
  // Borrow the sibling's classes so it inherits Kick's sizing, hover and
  // focus treatment instead of being styled from scratch.
  switchButton.className = anchorButton.className;
  switchButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block shrink-0" xmlns="http://www.w3.org/2000/svg"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>`;
  switchButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setPreferCustom();
    switchToCustom();
  });

  anchorButton.parentElement.insertBefore(switchButton, anchorButton);
  injectNativeExternalButton(anchorButton, switchButton);
}

export function injectNativeExternalButton(anchorButton, switchButton) {
  if (anchorButton.parentElement.querySelector("#k-native-ext-wrap")) return;

  const wrap = document.createElement("div");
  wrap.id = "k-native-ext-wrap";
  wrap.className = "k-ext-wrap";

  const button = document.createElement("button");
  button.type = "button";
  button.title = "Buka di player eksternal";
  button.setAttribute("aria-label", "Buka di player eksternal");
  button.className = anchorButton.className;
  button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block shrink-0" xmlns="http://www.w3.org/2000/svg"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;

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

    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const channelSlug = pathParts[0];
    const videoSlug = pathParts[2];
    const cacheKey = `${channelSlug}/${videoSlug}`;

    wrap.classList.add("open");

    if (state.nativeExternalCache?.key !== cacheKey) {
      menu.innerHTML = `<div class="k-ext-heading">Mengambil stream URL...</div>`;
      const resolved = await resolveStream(channelSlug, videoSlug);
      if (!resolved) {
        menu.innerHTML = `<div class="k-ext-heading">Stream tidak ketemu</div>`;
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
  switchButton.parentElement.insertBefore(wrap, switchButton);
}
