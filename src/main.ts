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

(function () {
  "use strict";

  console.log("Kick Unlocker: Userscript loaded (v20.0 - Instant Zap)");

  GM_addStyle(css);

  let globalPlayerListenersBound = false;


  function bindGlobalPlayerListeners() {
    if (globalPlayerListenersBound) return;

    document.addEventListener("click", (event) => {
      [state.activePlayerUi?.qualWrap, state.activePlayerUi?.extWrap].forEach((wrap) => {
        if (!wrap || !wrap.isConnected) return;
        if (!wrap.contains(event.target)) wrap.classList.remove("open");
      });
    });

    // Player controls keep DOM focus after a click, so the keydown handler
    // below would see them as the event target and bail out. Drop focus once
    // the pointer is released so later key presses reach the player.
    document.addEventListener("pointerup", (event) => {
      const focusHolder = (event.target as any)?.closest?.(
        "#k-controls button, #k-controls input, #k-big-play, .k-center-seek",
      );
      if (focusHolder) focusHolder.blur();
    });

    document.addEventListener(
      "keydown",
      (event) => {
        const playerUi = state.activePlayerUi;
        const videoElement = playerUi?.vid;
        if (!videoElement || !videoElement.isConnected) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        const target: any = event.target;
        if (
          target?.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)
        )
          return;

        const seekBy = (seconds) => {
          if (!isFinite(videoElement.duration)) return;
          videoElement.currentTime = Math.min(
            Math.max(videoElement.currentTime + seconds, 0),
            videoElement.duration,
          );
          playerUi.showSeekIndicator(seconds > 0 ? "forward" : "backward");
          playerUi.renderProgress?.(videoElement.currentTime);
        };

        const seekToPercent = (percent) => {
          if (!isFinite(videoElement.duration)) return;
          const target = videoElement.duration * percent;
          const direction =
            target > videoElement.currentTime ? "forward" : "backward";
          videoElement.currentTime = target;
          playerUi.showSeekIndicator(direction);
          playerUi.renderProgress?.(target);
        };

        const nudgeVolume = (delta) =>
          playerUi.applyVolume(
            Math.min(Math.max(videoElement.volume + delta, 0), 1),
          );

        const setRate = (delta) => {
          videoElement.playbackRate = Math.min(
            Math.max(videoElement.playbackRate + delta, 0.25),
            4,
          );
        };

        const shortcuts = {
          arrowright: () => seekBy(5),
          arrowleft: () => seekBy(-5),
          l: () => seekBy(10),
          j: () => seekBy(-10),
          arrowup: () => nudgeVolume(0.05),
          arrowdown: () => nudgeVolume(-0.05),
          " ": () => playerUi.togglePlay(),
          k: () => playerUi.togglePlay(),
          f: () => playerUi.btnFs.click(),
          m: () =>
            playerUi.applyVolume(videoElement.volume === 0 ? 0.5 : 0),
          ">": () => setRate(0.25),
          ".": () => setRate(0.25),
          "<": () => setRate(-0.25),
          ",": () => setRate(-0.25),
          home: () => seekToPercent(0),
          end: () => seekToPercent(0.999),
        };

        for (let digit = 0; digit <= 9; digit++) {
          shortcuts[String(digit)] = () => seekToPercent(digit / 10);
        }

        const action = shortcuts[event.key.toLowerCase()];
        if (!action) return;

        event.preventDefault();
        event.stopPropagation();
        action();
        playerUi.showControls?.();
      },
      true, // capture phase, so this runs ahead of Kick's own key handlers
    );

    globalPlayerListenersBound = true;
  }


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

  function ensureCopyUrlButton() {
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
      container.innerHTML = `
            <div style="width:100%;height:100%;min-height:${fallbackMinHeight}px;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Inter,sans-serif;">
                <div style="font-size:18px;color:rgba(255,255,255,0.7);">Loading stream...</div>
            </div>
        `;

      const result =
        prefetched?.result || (await getVideoMetadata(channelSlug, videoSlug));
      if (!result) return; // Silent fail or keep deleted

      const streamUrl =
        prefetched?.streamUrl || (await findStreamUrlFromMetadata(result));
      if (!streamUrl) {
        container.innerHTML = `
              <div style="width:100%;height:100%;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Inter,sans-serif;">
                  <div style="font-size:20px;color:rgba(255,255,255,0.7);font-weight:bold;">Stream Not Found</div>
              </div>`;
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
        container.innerHTML = `<div style="display:flex;width:100%;height:100%;"><div id="unlocker-video-area" style="flex:1;background:#000;position:relative;"></div><div id="unlocker-chat-area" style="width:320px;height:100%;border-left:1px solid #333;"></div></div>`;
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
      const playerHTML = `
            <div id="k-player" style="width:100%;height:100%;position:relative;background:black;overflow:hidden;font-family:Inter,sans-serif;">
                <video id="k-video" playsinline style="width:100%;height:100%;object-fit:contain;"></video>
                <div id="k-loading" class="visible" aria-hidden="true">
                    <div class="k-loading-spinner"></div>
                </div>
                <div id="k-controls" style="position:absolute;bottom:0;left:0;width:100%;padding:20px 15px 10px 15px;background:linear-gradient(to top, rgba(0,0,0,0.9), transparent);display:flex;flex-direction:column;opacity:0;transition:opacity 0.2s;">
                    <div id="k-track" style="width:100%;height:5px;padding:8px 0;background:rgba(255,255,255,0.3);background-clip:content-box;box-sizing:content-box;cursor:pointer;position:relative;margin-bottom:4px;border-radius:2px;">
                        <div id="k-track-tooltip">
                            <div id="k-track-tooltip-time">0:00</div>
                        </div>
                         <div id="k-progress" style="width:0%;height:100%;background:#53fc18;position:relative;border-radius:2px;"></div>
                    </div>
                    <div id="k-controls-row">
                        <div id="k-controls-left">
                            <button id="k-play" style="background:none;border:none;cursor:pointer;opacity:0.9;">${ICONS.play}</button>
                            <span id="k-time" style="font-size:13px;color:#ddd;font-variant-numeric:tabular-nums;">0:00 / 0:00</span>
                            <div id="k-volume-wrap">
                                <button id="k-volume-btn" type="button" aria-label="Mute volume">${ICONS.volumeHigh}</button>
                                <input id="k-volume" type="range" min="0" max="1" step="0.01" value="1">
                                <span id="k-volume-value">100%</span>
                            </div>
                        </div>
                        <div id="k-controls-right">
                            <button id="k-update-btn" type="button" title="Open latest update" style="display:none;">${ICONS.update}</button>
                            <button id="k-native-btn" type="button" title="Kembali ke player Kick">${ICONS.swap}</button>
                            <div id="k-ext-wrap" class="k-ext-wrap">
                                <button id="k-ext-btn" type="button" title="Open in external player" aria-label="Open in external player">${ICONS.external}</button>
                                <div id="k-ext-menu" class="k-ext-menu"></div>
                            </div>
                            <div id="k-quality-wrap">
                                <button id="k-quality-btn" type="button">Auto ▴</button>
                                <div id="k-quality-menu"></div>
                            </div>
                            <button id="k-fs" style="background:none;border:none;cursor:pointer;opacity:0.9;">${ICONS.maximize}</button>
                        </div>
                    </div>
                </div>
                <div id="k-seek-indicator" aria-hidden="true"></div>
                <button id="k-seek-back" class="k-center-seek" type="button" title="Mundur 10 detik" aria-label="Mundur 10 detik">
                    ${ICONS.backward}<span class="k-center-seek-label">10</span>
                </button>
                <button id="k-big-play" style="position:absolute;top:50%;left:50%;width:70px;height:70px;background:rgba(7,7,7,0.72);border-radius:50%;border:1px solid rgba(255,255,255,0.18);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                    ${ICONS.bigPlay}
                </button>
                <button id="k-seek-fwd" class="k-center-seek" type="button" title="Maju 10 detik" aria-label="Maju 10 detik">
                    ${ICONS.forward}<span class="k-center-seek-label">10</span>
                </button>
            </div>
        `;

      videoParent.innerHTML = playerHTML;
      const pRoot = videoParent.querySelector("#k-player");
      const vid = videoParent.querySelector("#k-video");
      const controls = videoParent.querySelector("#k-controls");
      const btnPlay = videoParent.querySelector("#k-play");
      const btnFs = videoParent.querySelector("#k-fs");
      const btnUpdate = videoParent.querySelector("#k-update-btn");
      const btnNative = videoParent.querySelector("#k-native-btn");
      if (manualSwitch && btnNative) {
        btnNative.style.display = "inline-flex";
        btnNative.addEventListener("click", (event) => {
          event.stopPropagation();
          clearPreferCustom();
          // Kick mounts its player during page bootstrap, so a reload is the
          // only reliable way to get it back.
          window.location.reload();
        });
      }
      const btnBig = videoParent.querySelector("#k-big-play");
      const btnSeekBack = videoParent.querySelector("#k-seek-back");
      const btnSeekFwd = videoParent.querySelector("#k-seek-fwd");
      const progressBar = videoParent.querySelector("#k-progress");
      const track = videoParent.querySelector("#k-track");
      const trackTooltip = videoParent.querySelector("#k-track-tooltip");
      const trackTooltipTime = videoParent.querySelector(
        "#k-track-tooltip-time",
      );
      const timeDisplay = videoParent.querySelector("#k-time");
      const qualWrap = videoParent.querySelector("#k-quality-wrap");
      const extWrap = videoParent.querySelector("#k-ext-wrap");
      const extBtn = videoParent.querySelector("#k-ext-btn");
      const extMenu = videoParent.querySelector("#k-ext-menu");
      const qualBtn = videoParent.querySelector("#k-quality-btn");
      const qualMenu = videoParent.querySelector("#k-quality-menu");
      const seekIndicator = videoParent.querySelector("#k-seek-indicator");
      const loadingOverlay = videoParent.querySelector("#k-loading");

      const volumeWrap = videoParent.querySelector("#k-volume-wrap");
      const volumeButton = videoParent.querySelector("#k-volume-btn");
      const volumeSlider = videoParent.querySelector("#k-volume");
      const volumeValue = videoParent.querySelector("#k-volume-value");
      const initialVolume =
        Number.isFinite(savedPlayerSettings.volume) ?
          savedPlayerSettings.volume
        : 1;
      let seekIndicatorTimeout = null;
      let hasStartedPlayback = false;
      let loadingStateTimeout = null;
      let previousVolumeBeforeMute = initialVolume > 0 ? initialVolume : 1;

      const updateVolumeSliderVisual = (volume) => {
        const percent = Math.max(0, Math.min(100, Math.round(volume * 100)));
        volumeSlider.style.setProperty("--k-volume-percent", `${percent}%`);
        volumeValue.textContent = `${percent}%`;
        volumeButton.innerHTML = getVolumeIcon(volume);
        volumeButton.setAttribute(
          "aria-label",
          percent === 0 ? "Unmute volume" : "Mute volume",
        );
        volumeWrap.dataset.muted = percent === 0 ? "true" : "false";
      };

      const applyVolume = (volume, { persist = true } = {}) => {
        const normalizedVolume = Math.max(0, Math.min(1, Number(volume) || 0));
        if (normalizedVolume > 0) previousVolumeBeforeMute = normalizedVolume;

        vid.muted = normalizedVolume === 0;
        vid.volume = normalizedVolume;
        volumeSlider.value = String(normalizedVolume);
        updateVolumeSliderVisual(normalizedVolume);

        if (persist) {
          savePlayerSettings(playerSettingsKey, { volume: normalizedVolume });
        }
      };

      const setLoadingState = (isLoading, { immediate = false } = {}) => {
        clearTimeout(loadingStateTimeout);

        if (!isLoading) {
          loadingOverlay.classList.remove("visible");
          return;
        }

        if (immediate) {
          loadingOverlay.classList.add("visible");
          return;
        }

        loadingStateTimeout = setTimeout(() => {
          if (!vid.paused && !vid.ended) {
            loadingOverlay.classList.add("visible");
          }
        }, 250);
      };

      const showSeekIndicator = (direction) => {
        seekIndicator.innerHTML =
          direction === "forward" ? ICONS.forward : ICONS.backward;
        seekIndicator.dataset.direction = direction;
        seekIndicator.classList.remove("visible");
        void seekIndicator.offsetWidth;
        seekIndicator.classList.add("visible");
        clearTimeout(seekIndicatorTimeout);
        seekIndicatorTimeout = setTimeout(() => {
          seekIndicator.classList.remove("visible");
        }, 850);
      };

      const CONTROLS_HIDE_DELAY = 2500;
      let controlsHideTimeout = null;
      let pointerOverControls = false;
      let controlsShown = false;
      // Captured on pointerdown, before browsers fire their synthetic mouse
      // events after a tap — those would otherwise flip the state we compare
      // against in the click handler.
      let controlsShownAtGestureStart = false;
      let lastPointerType = "mouse";
      let touchMode = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;

      const setCenterSeekVisible = (visible) => {
        [btnSeekBack, btnSeekFwd].forEach((button) =>
          button.classList.toggle("visible", visible),
        );
      };

      // On touch the centre button rides with the overlay so there is always
      // something to tap to pause. With a mouse it keeps the old behaviour of
      // only appearing while paused.
      const syncBigButton = () => {
        btnBig.innerHTML = vid.paused ? ICONS.bigPlay : ICONS.bigPause;
        btnBig.classList.toggle(
          "visible",
          touchMode ? controlsShown || vid.paused : vid.paused,
        );
      };

      const hideControlsNow = () => {
        clearTimeout(controlsHideTimeout);
        controls.style.opacity = "0";
        setCenterSeekVisible(false);
        trackTooltip.classList.remove("visible");
        qualWrap.classList.remove("open");
        extWrap.classList.remove("open");
        controlsShown = false;
        syncBigButton();
        if (document.fullscreenElement) pRoot.style.cursor = "none";
      };

      const scheduleControlsHide = () => {
        clearTimeout(controlsHideTimeout);
        controlsHideTimeout = setTimeout(() => {
          // Anything that implies the user is still working the player keeps
          // the bar up: paused video, pointer parked on the controls, or an
          // open menu.
          if (vid.paused) return;
          if (pointerOverControls) return;
          if (qualWrap.classList.contains("open")) return;
          if (extWrap.classList.contains("open")) return;

          hideControlsNow();
        }, CONTROLS_HIDE_DELAY);
      };

      const showControls = ({ keepOpen = false } = {}) => {
        clearTimeout(controlsHideTimeout);
        controls.style.opacity = "1";
        setCenterSeekVisible(true);
        controlsShown = true;
        syncBigButton();
        pRoot.style.cursor = "";
        if (!keepOpen) scheduleControlsHide();
      };

      const centerSeek = (seconds) => {
        if (!isFinite(vid.duration)) return;
        vid.currentTime = Math.min(
          Math.max(vid.currentTime + seconds, 0),
          vid.duration,
        );
        showSeekIndicator(seconds > 0 ? "forward" : "backward");
        renderProgress(vid.currentTime);
        showControls();
      };

      [
        [btnSeekBack, -10],
        [btnSeekFwd, 10],
      ].forEach(([button, seconds]) => {
        button.addEventListener("click", (event) => {
          // The video element below has its own click-to-toggle-play handler.
          event.stopPropagation();
          centerSeek(seconds);
          button.classList.add("bump");
          setTimeout(() => button.classList.remove("bump"), 90);
        });
        button.addEventListener("dblclick", (event) => event.stopPropagation());
      });

      state.activePlayerUi = {
        vid,
        pRoot,
        qualWrap,
        extWrap,
        btnFs,
        showSeekIndicator,
        showControls,
        renderProgress: (time) => renderProgress(time),
        // Wrapped in arrows so `togglePlay` below is out of its temporal dead
        // zone by the time a key press actually fires these.
        applyVolume: (volume) => applyVolume(volume),
        togglePlay: () => togglePlay(),
      };
      bindGlobalPlayerListeners();

      applyVolume(initialVolume, { persist: false });

      getLatestReleaseInfo().then((release) => {
        if (!release || !btnUpdate?.isConnected) return;

        btnUpdate.style.display = "inline-flex";
        btnUpdate.title = `Update available: ${release.name || release.tagName}`;
        btnUpdate.addEventListener(
          "click",
          () => {
            window.open(release.htmlUrl, "_blank", "noopener,noreferrer");
          },
          { once: true },
        );
      });

      // ---- External player handoff -------------------------------------
      // `streamUrl` is the raw master playlist; `finalUrl` only differs by the
      // cache-busting query param the in-page player needs, so hand off the
      // clean one.
      populateExternalMenu(
        extMenu,
        buildExternalTargets(streamUrl, makeVideoTitle(result)),
        () => extWrap.classList.remove("open"),
      );

      extBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        qualWrap.classList.remove("open");
        extWrap.classList.toggle("open");
      });

      qualBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        extWrap.classList.remove("open");
        qualWrap.classList.toggle("open");
      });

      volumeSlider.addEventListener("input", () => {
        applyVolume(parseFloat(volumeSlider.value));
      });

      volumeButton.addEventListener("click", () => {
        if (vid.volume <= 0 || vid.muted) {
          applyVolume(
            previousVolumeBeforeMute > 0 ? previousVolumeBeforeMute : 1,
          );
          return;
        }

        previousVolumeBeforeMute =
          vid.volume > 0 ? vid.volume : previousVolumeBeforeMute;
        applyVolume(0);
      });

      chatController.connectVideo(vid);

      const togglePlay = () => {
        if (vid.paused) vid.play();
        else vid.pause();
      };
      // Touch taps only toggle the controls overlay, YouTube-style. Playback
      // is toggled by the play button. Mouse clicks keep click-to-play.
      vid.addEventListener("pointerdown", (event) => {
        lastPointerType = event.pointerType || "mouse";
        if (lastPointerType !== "mouse") touchMode = true;
        controlsShownAtGestureStart = controlsShown;
      });
      let lastTapTime = 0;
      vid.addEventListener("click", () => {
        if (lastPointerType === "mouse") {
          togglePlay();
          return;
        }

        const now = Date.now();
        if (now - lastTapTime < 300) {
          lastTapTime = 0;
          btnFs.click();
          showControls();
          return;
        }
        lastTapTime = now;

        if (controlsShownAtGestureStart) hideControlsNow();
        else showControls();
      });
      btnPlay.addEventListener("click", togglePlay);
      btnBig.addEventListener("click", togglePlay);
      vid.addEventListener("play", () => {
        btnPlay.innerHTML = ICONS.pause;
        syncBigButton();
      });
      vid.addEventListener("pause", () => {
        btnPlay.innerHTML = ICONS.play;
        syncBigButton();
      });
      vid.addEventListener("playing", () => {
        hasStartedPlayback = true;
        setLoadingState(false);
      });
      vid.addEventListener("waiting", () => {
        if (!vid.paused) setLoadingState(true);
      });
      vid.addEventListener("seeking", () => {
        if (hasStartedPlayback) setLoadingState(true);
      });
      vid.addEventListener("seeked", () => {
        if (!vid.paused && vid.readyState >= 3) setLoadingState(false);
      });
      vid.addEventListener("canplay", () => {
        if (!vid.paused && hasStartedPlayback) setLoadingState(false);
      });
      vid.addEventListener("stalled", () => {
        if (!vid.paused) setLoadingState(true);
      });
      vid.addEventListener("loadeddata", () => {
        if (vid.paused && !hasStartedPlayback) setLoadingState(false);
      });
      vid.addEventListener("ended", () => setLoadingState(false));
      let lastSave = 0;

      vid.addEventListener("timeupdate", () => {
        if (Date.now() - lastSave > 4000) {
          saveResumeTime(resumeKey, vid.currentTime);
          lastSave = Date.now();
        }

        if (isFinite(vid.duration) && !isScrubbing) {
          renderProgress(vid.currentTime);
        }
      });
      vid.addEventListener("ended", () => {
        clearResumeTime(resumeKey);
      });
      // Rendering the bar is split out so a seek can paint the new position
      // immediately instead of waiting for the next `timeupdate`, which does
      // not fire until the player has finished buffering the new spot.
      const renderProgress = (time) => {
        if (!isFinite(vid.duration)) return;
        progressBar.style.width = (time / vid.duration) * 100 + "%";
        timeDisplay.textContent = `${formatTime(time)} / ${formatTime(vid.duration)}`;
      };

      let isScrubbing = false;
      let scrubPointerId = null;

      const ratioFromPointer = (clientX) => {
        const rect = track.getBoundingClientRect();
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      };

      const paintScrub = (clientX) => {
        if (!isFinite(vid.duration)) return;
        const ratio = ratioFromPointer(clientX);
        const rect = track.getBoundingClientRect();
        renderProgress(ratio * vid.duration);
        trackTooltipTime.textContent = formatTime(ratio * vid.duration);
        trackTooltip.style.left = `${ratio * rect.width}px`;
        trackTooltip.classList.add("visible");
        return ratio;
      };

      track.addEventListener("pointerdown", (event) => {
        if (!isFinite(vid.duration)) return;
        event.preventDefault();
        event.stopPropagation();
        isScrubbing = true;
        scrubPointerId = event.pointerId;
        track.classList.add("scrubbing");
        track.setPointerCapture(event.pointerId);
        paintScrub(event.clientX);
        showControls({ keepOpen: true });
      });

      track.addEventListener("pointermove", (event) => {
        if (!isScrubbing || event.pointerId !== scrubPointerId) return;
        event.preventDefault();
        paintScrub(event.clientX);
      });

      const endScrub = (event) => {
        if (!isScrubbing || event.pointerId !== scrubPointerId) return;
        isScrubbing = false;
        scrubPointerId = null;
        track.classList.remove("scrubbing");
        trackTooltip.classList.remove("visible");

        const ratio = ratioFromPointer(event.clientX);
        if (isFinite(vid.duration)) {
          const targetTime = ratio * vid.duration;
          vid.currentTime = targetTime;
          renderProgress(targetTime);
        }
        showControls();
      };

      track.addEventListener("pointerup", endScrub);
      track.addEventListener("pointercancel", endScrub);
      // The video underneath toggles the overlay on tap; a scrub is not a tap.
      track.addEventListener("click", (event) => event.stopPropagation());

      track.addEventListener("mousemove", (e) => {
        if (isScrubbing || !isFinite(vid.duration)) return;
        const rect = track.getBoundingClientRect();
        const ratio = ratioFromPointer(e.clientX);

        trackTooltipTime.textContent = formatTime(ratio * vid.duration);
        trackTooltip.style.left = `${ratio * rect.width}px`;
        trackTooltip.classList.add("visible");
      });
      track.addEventListener("mouseenter", () => {
        if (isFinite(vid.duration)) trackTooltip.classList.add("visible");
      });
      track.addEventListener("mouseleave", () => {
        trackTooltip.classList.remove("visible");
      });
      pRoot.addEventListener("mouseenter", () => showControls());
      pRoot.addEventListener("mousemove", () => showControls());
      pRoot.addEventListener("mouseleave", () => {
        clearTimeout(controlsHideTimeout);
        qualWrap.classList.remove("open");
        extWrap.classList.remove("open");
        trackTooltip.classList.remove("visible");
        pRoot.style.cursor = "";
        if (!vid.paused) controls.style.opacity = "0";
        if (!vid.paused) setCenterSeekVisible(false);
        if (!vid.paused) controlsShown = false;
      });
      controls.addEventListener("mouseenter", () => {
        pointerOverControls = true;
        showControls({ keepOpen: true });
      });
      controls.addEventListener("mouseleave", () => {
        pointerOverControls = false;
        scheduleControlsHide();
      });
      vid.addEventListener("play", () => scheduleControlsHide());
      vid.addEventListener("pause", () => showControls({ keepOpen: true }));
      document.addEventListener("fullscreenchange", () => {
        if (pRoot.isConnected) showControls();
      });
      btnFs.addEventListener("click", () => {
        if (!document.fullscreenElement) pRoot.requestFullscreen();
        else document.exitFullscreen();
      });
      vid.addEventListener("dblclick", () => {
        if (lastPointerType === "mouse") btnFs.click();
      });

      if (Hls.isSupported()) {
        const hls = new Hls({
          debug: false,
          enableWorker: false,
          lowLatencyMode: true,
        });
        state.activeHls = hls;
        hls.loadSource(finalUrl);
        hls.attachMedia(vid);
        hls.on(Hls.Events.MANIFEST_LOADING, () =>
          setLoadingState(true, { immediate: true }),
        );
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoadingState(false);
          const setQuality = (
            level,
            label,
            optionRef = null,
            qualitySettings = null,
          ) => {
            hls.currentLevel = level;
            qualBtn.textContent = `${label} ▴`;
            [...qualMenu.querySelectorAll(".k-quality-option")].forEach(
              (option) => option.classList.remove("active"),
            );
            if (optionRef) optionRef.classList.add("active");
            if (qualitySettings)
              savePlayerSettings(playerSettingsKey, {
                quality: qualitySettings,
              });
            qualWrap.classList.remove("open");
          };

          const addQualityItem = (
            level,
            label,
            qualitySettings,
            isActive = false,
          ) => {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "k-quality-option";
            item.textContent = label;
            if (isActive) item.classList.add("active");
            item.addEventListener("click", (e) => {
              e.stopPropagation();
              setQuality(level, label, item, qualitySettings);
            });
            qualMenu.appendChild(item);
            return item;
          };

          const qualityItems = [];
          const autoItem = addQualityItem(-1, "Auto", { mode: "auto" }, true);

          hls.levels
            .map((lvl, idx) => ({ lvl, idx }))
            .sort((a, b) => (b.lvl.height || 0) - (a.lvl.height || 0))
            .forEach(({ lvl, idx }) => {
              qualityItems.push({
                height: lvl.height,
                level: idx,
                label: `${lvl.height}p`,
                element: addQualityItem(idx, `${lvl.height}p`, {
                  mode: "manual",
                  height: lvl.height,
                }),
              });
            });

          const savedQuality = savedPlayerSettings.quality;
          if (savedQuality?.mode === "manual") {
            const matchedQuality = qualityItems.find(
              (item) => item.height === savedQuality.height,
            );
            if (matchedQuality) {
              setQuality(
                matchedQuality.level,
                matchedQuality.label,
                matchedQuality.element,
                { mode: "manual", height: matchedQuality.height },
              );
            } else {
              setQuality(-1, "Auto", autoItem, { mode: "auto" });
            }
          } else {
            setQuality(-1, "Auto", autoItem, { mode: "auto" });
          }

          vid.play().catch(() => btnBig.classList.add("visible"));
        });
        const savedTime = parseFloat(readResumeTime(resumeKey));

        if (Number.isFinite(savedTime) && savedTime > 1) {
          vid.addEventListener(
            "loadedmetadata",
            () => {
              if (Number.isFinite(vid.duration)) {
                vid.currentTime = Math.min(savedTime, vid.duration - 1);
              } else {
                vid.currentTime = savedTime;
              }
            },
            { once: true },
          );
        }

        hls.on(Hls.Events.ERROR, (e, data) => {
          if (data.fatal) setLoadingState(false);
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else if (data.type === Hls.ErrorTypes.MEDIA_ERROR)
              hls.recoverMediaError();
            else hls.destroy();
          }
        });
      } else if (vid.canPlayType("application/vnd.apple.mpegurl")) {
        vid.src = finalUrl;
      }
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
