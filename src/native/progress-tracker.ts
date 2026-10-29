import { NATIVE_VIDEO_SELECTOR } from "../constants.ts";
import {
  getPreferCustom,
  getProgressKey,
  saveWatchProgress,
} from "../lib/storage.ts";
import { getVodSlugs } from "../lib/vod-slugs.ts";
import { state } from "../state.ts";
import { isVodPage } from "./detect.ts";

// Records watch progress while Kick's own player is the one being watched, so
// the thumbnail bar works without the custom player too. The custom player
// records its own in controls.ts.

const SAVE_INTERVAL_MS = 4000;

const tracked = new WeakSet<HTMLVideoElement>();

function currentProgressKey() {
  if (!isVodPage()) return null;
  const { channelSlug, videoSlug } = getVodSlugs();
  return getProgressKey(channelSlug, videoSlug);
}

// Kick's player is about to be swapped out, or already has been. Its position
// is not the user's: it starts every VOD from zero, and writing that would
// wipe out the position the custom player is about to resume from.
function customPlayerOwnsProgress() {
  return Boolean(
    state.activePlayerUi || state.isUnlocking || getPreferCustom(),
  );
}

export function trackNativeProgress() {
  if (!isVodPage()) return;
  // By id only, unlike getNativeVideo(): its any-<video> fallback could pick
  // up a card's hover preview and record that against this VOD.
  const video = document.querySelector<HTMLVideoElement>(NATIVE_VIDEO_SELECTOR);
  if (!video || tracked.has(video)) return;
  tracked.add(video);

  // Kick may keep the element across an SPA navigation, and the URL changes
  // before the next VOD starts loading. So the key is bound when a source
  // starts loading, and nothing is written while the URL points elsewhere:
  // the old VOD's last few seconds must not land on the new one.
  let progressKey = currentProgressKey();
  let lastSave = Date.now();
  video.addEventListener("loadstart", () => {
    progressKey = currentProgressKey();
    lastSave = Date.now();
  });

  const save = (time: number) => {
    if (!progressKey || progressKey !== currentProgressKey()) return;
    if (customPlayerOwnsProgress()) return;
    saveWatchProgress(progressKey, time, video.duration);
  };

  video.addEventListener("timeupdate", () => {
    if (video.paused || Date.now() - lastSave < SAVE_INTERVAL_MS) return;
    lastSave = Date.now();
    save(video.currentTime);
  });
  video.addEventListener("ended", () => save(video.duration));
}
