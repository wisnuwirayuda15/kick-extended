import Hls from "hls.js";
import css from "./styles.css?raw";
import { ICONS } from "./icons.ts";
import {
  AUTO_SWITCH_SETTLE_MS,
  BADGE_SELECTOR,
  CHANNEL_NAME_SELECTOR,
  CONTROL_ANCHOR_SELECTOR,
  KICK_CHAT_SELECTOR,
  NATIVE_VIDEO_FALLBACK_SELECTOR,
  NATIVE_VIDEO_SELECTOR,
  PLAYER_CONTAINER_SELECTOR,
  SUBSCRIBER_ONLY_SELECTOR,
  SUBSCRIBER_OVERLAY_CONTAINER_SELECTOR,
} from "./constants.ts";
import { checkStreamUrl, gmFetch } from "./lib/gm-fetch.ts";
import {
  clearPreferCustom,
  clearResumeTime,
  getPlayerSettingsKey,
  getPreferCustom,
  getResumeKey,
  isVersionGreater,
  loadPlayerSettings,
  readResumeTime,
  saveResumeTime,
  savePlayerSettings,
  setPreferCustom,
} from "./lib/storage.ts";
import { formatTime, getVolumeIcon } from "./lib/format.ts";
import { showToast } from "./lib/toast.ts";
import { getLatestReleaseInfo } from "./lib/update-check.ts";
import {
  findStreamUrlFromMetadata,
  getVideoMetadata,
  resolveStream,
} from "./lib/kick-api.ts";
import { ChatController } from "./chat/chat-controller.ts";
import { state } from "./state.ts";
import {
  findCopyButtonAnchor,
  findNativePlayerContainer,
  getNativeVideo,
  isNativePlayerReady,
  isVodPage,
} from "./native/detect.ts";
import { stopNativePlayback } from "./native/teardown.ts";
import {
  buildExternalTargets,
  makeVideoTitle,
  populateExternalMenu,
} from "./player/external.ts";
import { ensureCopyUrlButton } from "./native/copy-url-button.ts";
import { bindGlobalPlayerListeners } from "./player/shortcuts.ts";
import {
  buildChatShellMarkup,
  buildPlayerMarkup,
  buildSplashMarkup,
  buildStreamNotFoundMarkup,
} from "./player/markup.ts";
import { setupPlayback } from "./player/quality.ts";
import { createControls } from "./player/controls.ts";

(function () {
  "use strict";

  console.log("Kick Unlocker: Userscript loaded (v20.0 - Instant Zap)");

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

    const customVideo = state.activePlayerUi?.vid || document.querySelector("#k-video");
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

  // Kick routes client-side, so there is no navigation event to hook. Patch
  // the history methods and cover the back/forward button separately.
  ["pushState", "replaceState"].forEach((method) => {
    const original = history[method];
    history[method] = function (...args) {
      const returned = original.apply(this, args);
      handleLocationChange();
      return returned;
    };
  });
  window.addEventListener("popstate", handleLocationChange);
  window.addEventListener("hashchange", handleLocationChange);
  window.addEventListener("pagehide", destroyCustomPlayer);

  function ensureCustomPlayerToggle() {
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

  function injectNativeExternalButton(anchorButton, switchButton) {
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

  async function unlockVideo(triggerElement, options: any = {}) {
    const { explicitContainer = null, manualSwitch = false } = options;
    if (state.isUnlocking) return;
    const container =
      explicitContainer ||
      triggerElement?.closest(PLAYER_CONTAINER_SELECTOR) ||
      null;
    if (!container || container.dataset.kickUnlockerProcessing) return;

    const pathParts = window.location.pathname.split("/").filter(Boolean);
    let channelSlug = pathParts[0];
    let videoSlug = pathParts[2];
    if (!videoSlug && pathParts[1] === "video") videoSlug = pathParts[2];
    const resumeKey = getResumeKey(channelSlug, videoSlug);
    const playerSettingsKey = getPlayerSettingsKey(channelSlug, videoSlug);
    const savedPlayerSettings = loadPlayerSettings(playerSettingsKey);

    state.isUnlocking = true;

    try {
      // When we are replacing a native player that already works, resolve the
      // stream first. A failure after the container is wiped leaves the page
      // dead with no way back, so nothing is torn down until this succeeds.
      let prefetched = null;
      if (manualSwitch) {
        prefetched = await resolveStream(channelSlug, videoSlug);
        if (!prefetched) {
          clearPreferCustom();
          showToast(
            "KickNoSub: stream tidak ketemu, tetap pakai player Kick. Auto-switch dimatikan.",
          );
          return;
        }
      }

      // Kick's own player may keep decoding audio if we only wipe the DOM
      // around it, so stop it explicitly first.
      stopNativePlayback(container);

      const containerRect = container.getBoundingClientRect();
      const fallbackMinHeight = Math.max(
        Math.round(containerRect.height || 0),
        Math.round(((containerRect.width || 0) * 9) / 16),
        360,
      );

      container.style.width = "100%";
      container.style.minHeight = `${fallbackMinHeight}px`;

      if (containerRect.width > 0 && containerRect.height > 0) {
        container.style.aspectRatio = `${containerRect.width} / ${containerRect.height}`;
      } else {
        container.style.aspectRatio = "16 / 9";
      }

      if (state.activeHls) {
        state.activeHls.destroy();
        state.activeHls = null;
      }

      // --- STEP 1: FULL WIPE & SPLASH ---
      container.innerHTML = buildSplashMarkup(fallbackMinHeight);

      const result =
        prefetched?.result || (await getVideoMetadata(channelSlug, videoSlug));
      if (!result) return; // Silent fail or keep deleted

      const streamUrl =
        prefetched?.streamUrl || (await findStreamUrlFromMetadata(result));
      if (!streamUrl) {
        container.innerHTML = buildStreamNotFoundMarkup();
        return;
      }

      // --- STEP 2: FULL UNLOCK ---
      container.dataset.kickUnlockerProcessing = "true";
      container.innerHTML = ""; // WIPE ALL
      container.style.background = "#000";

      // Check for Chat
      const existingChat: any = document.querySelector(KICK_CHAT_SELECTOR);
      let chatRoot = null;
      if (existingChat) {
        existingChat.innerHTML = "";
        existingChat.style.display = "block";
        chatRoot = existingChat;
      } else {
        container.innerHTML = buildChatShellMarkup();
        chatRoot = container.querySelector("#unlocker-chat-area");
      }

      const startTime = new Date(
        result.video.start_time.replace(" ", "T") +
          (result.video.start_time.endsWith("Z") ? "" : "Z"),
      );
      const chatController = new ChatController(
        result.channelId,
        startTime,
        chatRoot,
      );
      chatController.init(null);
      state.activeChatController = chatController;

      const finalUrl =
        streamUrl +
        (streamUrl.includes("?") ? "&" : "?") +
        "kick_ts=" +
        Date.now();
      let videoParent =
        existingChat ? container : (
          container.querySelector("#unlocker-video-area")
        );

      // Build Custom Player UI
      const playerHTML = buildPlayerMarkup();

      videoParent.innerHTML = playerHTML;
      const { vid, btnBig, qualBtn, qualMenu, qualWrap, setLoadingState } =
        createControls({
          videoParent,
          manualSwitch,
          resumeKey,
          playerSettingsKey,
          savedPlayerSettings,
          streamUrl,
          result,
          chatController,
          finalUrl,
        });

      setupPlayback(
        { vid, btnBig, qualBtn, qualMenu, qualWrap, setLoadingState },
        { finalUrl, resumeKey, playerSettingsKey, savedPlayerSettings },
      );
    } catch (e) {
      console.error(e);
      if (container) delete container.dataset.kickUnlockerProcessing;
    } finally {
      state.isUnlocking = false;
    }
  }

  const observer = new MutationObserver(() => {
    handleLocationChange();

    // React can rip our player out without any navigation event firing.
    if (state.activePlayerUi?.vid && !state.activePlayerUi.vid.isConnected) {
      destroyCustomPlayer();
    }

    const subscriberOverlay = document.querySelector(
      SUBSCRIBER_ONLY_SELECTOR,
    );

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
      return;
    }

    ensureCustomPlayerToggle();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  ensureCustomPlayerToggle();
})();
