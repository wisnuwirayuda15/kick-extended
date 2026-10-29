import {
  AUTO_CUSTOM_KEY,
  DISABLE_SPA_KEY,
  LEGACY_STORAGE_PREFIX,
  STORAGE_PREFIX,
} from "../constants.ts";

// Every localStorage access in the script goes through this file.
//
// The rename from the kick_unlocker_ prefix to kick_extended_ would otherwise
// wipe every resume position and per-video setting already in the browser, so
// writes use the new key while reads fall back to the old one and migrate the
// value across on first touch. Removals have to clear both keys, or a cleared
// value comes back from the legacy key on the next read.

function legacyKeyFor(key: string) {
  return key.startsWith(STORAGE_PREFIX)
    ? LEGACY_STORAGE_PREFIX + key.slice(STORAGE_PREFIX.length)
    : key;
}

function readMigrated(key: string) {
  const current = localStorage.getItem(key);
  if (current !== null) return current;

  const legacyKey = legacyKeyFor(key);
  if (legacyKey === key) return null;

  const legacyValue = localStorage.getItem(legacyKey);
  if (legacyValue === null) return null;

  localStorage.setItem(key, legacyValue);
  localStorage.removeItem(legacyKey);
  return legacyValue;
}

function removeBoth(key: string) {
  localStorage.removeItem(key);
  localStorage.removeItem(legacyKeyFor(key));
}

export function getResumeKey(channelSlug, videoSlug) {
  return `${STORAGE_PREFIX}resume:${channelSlug}:${videoSlug}`;
}

export function getPlayerSettingsKey(channelSlug, videoSlug) {
  return `${STORAGE_PREFIX}settings:${channelSlug}:${videoSlug}`;
}

export function loadPlayerSettings(settingsKey) {
  try {
    const raw = readMigrated(settingsKey);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function savePlayerSettings(settingsKey, partialSettings) {
  const currentSettings = loadPlayerSettings(settingsKey);
  localStorage.setItem(
    settingsKey,
    JSON.stringify({
      ...currentSettings,
      ...partialSettings,
    }),
  );
}

/** Resume position, stored as the raw currentTime the player wrote. */
export function readResumeTime(resumeKey) {
  return readMigrated(resumeKey);
}

export function saveResumeTime(resumeKey, currentTime) {
  localStorage.setItem(resumeKey, currentTime);
}

export function clearResumeTime(resumeKey) {
  removeBoth(resumeKey);
}

// Watch progress is kept apart from the resume position on purpose. Resume is
// cleared when a VOD ends so a rewatch starts from zero, but the thumbnail bar
// should then show the VOD as fully watched. It also carries the duration, so
// a thumbnail can draw the bar without knowing anything about the video.

export function getProgressKey(channelSlug, videoSlug) {
  return `${STORAGE_PREFIX}progress:${channelSlug}:${videoSlug}`;
}

/** Last watched position as { time, duration } in seconds, or null. */
export function readWatchProgress(progressKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(progressKey) || "null");
    const time = Number(parsed?.time);
    const duration = Number(parsed?.duration);
    if (!Number.isFinite(time) || !Number.isFinite(duration)) return null;
    if (duration <= 0) return null;
    return { time, duration };
  } catch (e) {
    return null;
  }
}

export function saveWatchProgress(progressKey, time, duration) {
  if (!Number.isFinite(time) || !Number.isFinite(duration)) return;
  if (duration <= 0) return;
  localStorage.setItem(progressKey, JSON.stringify({ time, duration }));
}

/** Whether the user prefers the custom player on normal VOD pages. */
export function getPreferCustom() {
  return readMigrated(AUTO_CUSTOM_KEY) === "1";
}

export function setPreferCustom() {
  localStorage.setItem(AUTO_CUSTOM_KEY, "1");
}

export function clearPreferCustom() {
  removeBoth(AUTO_CUSTOM_KEY);
}

/** Whether the user has turned Kick's client-side navigation off. */
export function getSpaDisabled() {
  return localStorage.getItem(DISABLE_SPA_KEY) === "1";
}

export function setSpaDisabled(disabled: boolean) {
  if (disabled) localStorage.setItem(DISABLE_SPA_KEY, "1");
  else localStorage.removeItem(DISABLE_SPA_KEY);
}
