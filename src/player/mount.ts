import { ChatController } from "../chat/chat-controller.ts";
import { KICK_CHAT_SELECTOR, PLAYER_CONTAINER_SELECTOR } from "../constants.ts";
import {
  findStreamUrlFromMetadata,
  getVideoMetadata,
  resolveStream,
} from "../lib/kick-api.ts";
import {
  clearPreferCustom,
  getPlayerSettingsKey,
  getResumeKey,
  loadPlayerSettings,
} from "../lib/storage.ts";
import { showToast } from "../lib/toast.ts";
import { stopNativePlayback } from "../native/teardown.ts";
import { state } from "../state.ts";
import { createControls } from "./controls.ts";
import {
  buildChatShellMarkup,
  buildPlayerMarkup,
  buildSplashMarkup,
  buildStreamNotFoundMarkup,
} from "./markup.ts";
import { setupPlayback } from "./quality.ts";

export async function unlockVideo(triggerElement, options: any = {}) {
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
