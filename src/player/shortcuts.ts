import { state } from "../state.ts";

// Installed once per page, never unbound. Every handler reaches the player
// through state.activePlayerUi, so the listeners survive a player being
// destroyed and remounted without needing to be rebound.
let globalPlayerListenersBound = false;

export function bindGlobalPlayerListeners() {
  if (globalPlayerListenersBound) return;

  document.addEventListener("click", (event) => {
    [state.activePlayerUi?.qualWrap, state.activePlayerUi?.extWrap].forEach(
      (wrap) => {
        if (!wrap || !wrap.isConnected) return;
        if (!wrap.contains(event.target)) wrap.classList.remove("open");
      },
    );
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
        m: () => playerUi.applyVolume(videoElement.volume === 0 ? 0.5 : 0),
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
