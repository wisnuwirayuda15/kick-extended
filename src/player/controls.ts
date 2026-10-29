import { ICONS } from "../icons.ts";
import { formatClock, getVolumeIcon } from "../lib/format.ts";
import {
  clearResumeTime,
  savePlayerSettings,
  saveResumeTime,
  saveWatchProgress,
} from "../lib/storage.ts";
import { state } from "../state.ts";
import {
  buildExternalTargets,
  makeVideoTitle,
  populateExternalMenu,
} from "./external.ts";
import { buildMenuOption } from "./markup.ts";
import { bindGlobalPlayerListeners } from "./shortcuts.ts";

/** The speeds Kick's own player offers. */
const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Queries the player's elements, defines its closures and wires all 42 of its
 * listeners. Moved out of unlockVideo as one contiguous slice, in order.
 *
 * The order is not incidental. Several events carry more than one handler
 * registered from what look like different concerns: chatController
 * .connectVideo(vid) adds timeupdate and seeking part-way through, ahead of
 * the loading-state and progress handlers that come later, so chat repaints
 * before the progress bar on every tick. Grouping the wiring by concern would
 * reorder them.
 *
 * For the same reason the 14 mutable locals stay declared inside this one
 * function body rather than becoming fields on a shared object: they are
 * written from handlers that a by-concern split would separate.
 */
export function createControls({
  videoParent,
  replaceNative,
  resumeKey,
  progressKey,
  playerSettingsKey,
  savedPlayerSettings,
  streamUrl,
  result,
  chatController,
}) {
  const pRoot = videoParent.querySelector("#k-player");
  const vid = videoParent.querySelector("#k-video");
  const controls = videoParent.querySelector("#k-controls");
  const btnPlay = videoParent.querySelector("#k-play");
  const btnFs = videoParent.querySelector("#k-fs");
  const btnBig = videoParent.querySelector("#k-big-play");
  const btnSeekBack = videoParent.querySelector("#k-seek-back");
  const btnSeekFwd = videoParent.querySelector("#k-seek-fwd");
  const progressBar = videoParent.querySelector("#k-progress");
  const bufferedBar = videoParent.querySelector("#k-buffered");
  const track = videoParent.querySelector("#k-track");
  const trackTooltip = videoParent.querySelector("#k-track-tooltip");
  const trackTooltipTime = videoParent.querySelector("#k-track-tooltip-time");
  const timeDisplay = videoParent.querySelector("#k-time");
  const qualWrap = videoParent.querySelector("#k-quality-wrap");
  const extWrap = videoParent.querySelector("#k-ext-wrap");
  const extBtn = videoParent.querySelector("#k-ext-btn");
  const extMenu = videoParent.querySelector("#k-ext-menu");
  const qualBtn = videoParent.querySelector("#k-quality-btn");
  const qualMenu = videoParent.querySelector("#k-quality-menu");
  const speedWrap = videoParent.querySelector("#k-speed-wrap");
  const speedBtn = videoParent.querySelector("#k-speed-btn");
  const speedMenu = videoParent.querySelector("#k-speed-menu");
  const menuWraps = [extWrap, speedWrap, qualWrap];
  const seekIndicator = videoParent.querySelector("#k-seek-indicator");
  const loadingOverlay = videoParent.querySelector("#k-loading");

  const volumeWrap = videoParent.querySelector("#k-volume-wrap");
  const volumeButton = videoParent.querySelector("#k-volume-btn");
  const volumeSlider = videoParent.querySelector("#k-volume");
  const initialVolume = Number.isFinite(savedPlayerSettings.volume)
    ? savedPlayerSettings.volume
    : 1;
  let seekIndicatorTimeout = null;
  let hasStartedPlayback = false;
  let loadingStateTimeout = null;
  let previousVolumeBeforeMute = initialVolume > 0 ? initialVolume : 1;

  const updateVolumeSliderVisual = (volume) => {
    const percent = Math.max(0, Math.min(100, Math.round(volume * 100)));
    volumeSlider.style.setProperty("--k-volume-percent", `${percent}%`);
    volumeButton.innerHTML = getVolumeIcon(volume);
    volumeButton.setAttribute("aria-label", percent === 0 ? "Unmute" : "Mute");
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

    // Re-check the element itself rather than trusting the event that asked.
    // `stalled` in particular fires under hls.js while buffered data is still
    // playing, and nothing afterwards would take the spinner back down.
    loadingStateTimeout = setTimeout(() => {
      if (!vid.paused && !vid.ended && isBuffering()) {
        loadingOverlay.classList.add("visible");
      }
    }, 250);
  };

  const isBuffering = () =>
    vid.seeking || vid.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;

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

  const closeMenus = () =>
    menuWraps.forEach((wrap) => wrap.classList.remove("open"));
  const isAnyMenuOpen = () =>
    menuWraps.some((wrap) => wrap.classList.contains("open"));
  const toggleMenu = (wrap) => {
    const opening = !wrap.classList.contains("open");
    closeMenus();
    wrap.classList.toggle("open", opening);
  };

  // The centre buttons are for touch, where there is nothing to hover and a
  // tap needs something to land on. Kick's desktop player has none, so with
  // a mouse they stay hidden.
  const setCenterSeekVisible = (visible) => {
    [btnSeekBack, btnSeekFwd].forEach((button) =>
      button.classList.toggle("visible", visible && touchMode),
    );
  };

  // On touch the centre button rides with the overlay so there is always
  // something to tap to pause. With a mouse it only stands in for autoplay
  // the browser blocked, until playback first starts.
  const syncBigButton = () => {
    btnBig.innerHTML = vid.paused ? ICONS.bigPlay : ICONS.bigPause;
    btnBig.classList.toggle(
      "visible",
      touchMode
        ? controlsShown || vid.paused
        : vid.paused && !hasStartedPlayback,
    );
  };

  const hideControlsNow = () => {
    clearTimeout(controlsHideTimeout);
    controls.style.opacity = "0";
    setCenterSeekVisible(false);
    trackTooltip.classList.remove("visible");
    closeMenus();
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
      if (isAnyMenuOpen()) return;

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
    menuWraps,
    btnFs,
    // Kick's player was swapped out for this one, rather than a subscriber-
    // only overlay; turning the custom player off has to bring it back.
    replacedNative: replaceNative,
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
    toggleMenu(extWrap);
  });

  qualBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu(qualWrap);
  });

  speedBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu(speedWrap);
  });

  // The menu follows the rate rather than setting it blindly: the < and >
  // shortcuts change it too, in steps the menu does not list.
  const speedOptions = PLAYBACK_RATES.map((rate) => {
    const option = buildMenuOption(`${rate}x`);
    option.addEventListener("click", (event) => {
      event.stopPropagation();
      vid.playbackRate = rate;
      closeMenus();
    });
    speedMenu.appendChild(option);
    return { rate, option };
  });
  const syncSpeedMenu = () =>
    speedOptions.forEach(({ rate, option }) =>
      option.classList.toggle("active", rate === vid.playbackRate),
    );
  vid.addEventListener("ratechange", syncSpeedMenu);
  syncSpeedMenu();

  volumeSlider.addEventListener("input", () => {
    applyVolume(parseFloat(volumeSlider.value));
  });

  volumeButton.addEventListener("click", () => {
    if (vid.volume <= 0 || vid.muted) {
      applyVolume(previousVolumeBeforeMute > 0 ? previousVolumeBeforeMute : 1);
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
    btnPlay.setAttribute("aria-label", "Pause");
    syncBigButton();
  });
  vid.addEventListener("pause", () => {
    btnPlay.innerHTML = ICONS.play;
    btnPlay.setAttribute("aria-label", "Play");
    syncBigButton();
    // The big play button takes over while paused; a spinner left up from a
    // seek would sit on top of it.
    setLoadingState(false);
  });
  vid.addEventListener("playing", () => {
    hasStartedPlayback = true;
    setLoadingState(false);
    syncBigButton();
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
  let lastPlaybackTime = vid.currentTime;

  vid.addEventListener("timeupdate", () => {
    // The event-driven show/hide above can miss its hide: after a seek the
    // browser does not always follow with `playing` or a `canplay` that finds
    // the element ready. Time actually advancing is proof the spinner is stale.
    if (vid.currentTime !== lastPlaybackTime && !vid.paused && !isBuffering()) {
      setLoadingState(false);
    }
    lastPlaybackTime = vid.currentTime;

    if (Date.now() - lastSave > 4000) {
      saveResumeTime(resumeKey, vid.currentTime);
      saveWatchProgress(progressKey, vid.currentTime, vid.duration);
      lastSave = Date.now();
    }

    if (isFinite(vid.duration) && !isScrubbing) {
      renderProgress(vid.currentTime);
    }
  });
  vid.addEventListener("ended", () => {
    clearResumeTime(resumeKey);
    // Resume restarts from zero, but the thumbnail shows it as watched.
    saveWatchProgress(progressKey, vid.duration, vid.duration);
  });
  // Rendering the bar is split out so a seek can paint the new position
  // immediately instead of waiting for the next `timeupdate`, which does
  // not fire until the player has finished buffering the new spot.
  const renderProgress = (time) => {
    if (!isFinite(vid.duration)) return;
    const percent = `${(time / vid.duration) * 100}%`;
    progressBar.style.width = percent;
    // The scrub handle hangs off the track, outside the bar that clips it.
    track.style.setProperty("--k-progress", percent);
    timeDisplay.textContent = `${formatClock(time)} / ${formatClock(vid.duration)}`;
  };

  // How far ahead the player has loaded from the current position, drawn
  // under the progress the way Kick's bar shows it.
  const renderBuffered = () => {
    if (!isFinite(vid.duration) || vid.duration <= 0) return;
    let end = 0;
    for (let i = 0; i < vid.buffered.length; i++) {
      if (vid.buffered.start(i) <= vid.currentTime + 0.5) {
        end = Math.max(end, vid.buffered.end(i));
      }
    }
    bufferedBar.style.width = `${Math.min(end / vid.duration, 1) * 100}%`;
  };
  vid.addEventListener("progress", renderBuffered);
  vid.addEventListener("timeupdate", renderBuffered);

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
    trackTooltipTime.textContent = formatClock(ratio * vid.duration);
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

    trackTooltipTime.textContent = formatClock(ratio * vid.duration);
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
    closeMenus();
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
    if (!pRoot.isConnected) return;
    const isFullscreen = document.fullscreenElement === pRoot;
    btnFs.innerHTML = isFullscreen ? ICONS.fullscreenExit : ICONS.fullscreen;
    const label = isFullscreen ? "Exit fullscreen" : "Fullscreen";
    btnFs.title = label;
    btnFs.setAttribute("aria-label", label);
    showControls();
  });
  btnFs.addEventListener("click", () => {
    if (!document.fullscreenElement) pRoot.requestFullscreen();
    else document.exitFullscreen();
  });
  vid.addEventListener("dblclick", () => {
    if (lastPointerType === "mouse") btnFs.click();
  });

  return { vid, btnBig, qualBtn, qualMenu, qualWrap, setLoadingState };
}
