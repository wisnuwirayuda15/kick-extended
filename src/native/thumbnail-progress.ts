import {
  STORAGE_PREFIX,
  THUMB_PROGRESS_CLASS,
  THUMB_PROGRESS_FLAG,
  VOD_PATH_REGEX,
} from "../constants.ts";
import {
  getProgressKey,
  getResumeKey,
  readResumeTime,
  readWatchProgress,
} from "../lib/storage.ts";
import { getVodSlugs } from "../lib/vod-slugs.ts";

// A YouTube-style bar along the bottom of each VOD thumbnail, showing how far
// into it the user got. The positions come from what the custom player and
// progress-tracker.ts record locally: Kick keeps no watch history of its own.

// Kick prints the duration on the card as h:mm:ss or mm:ss.
const DURATION_TEXT_REGEX = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/;

function readDurationBadge(anchor: Element) {
  for (const el of anchor.querySelectorAll("div, span")) {
    if (el.childElementCount) continue;
    const match = DURATION_TEXT_REGEX.exec(el.textContent?.trim() || "");
    if (match) {
      return (
        Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3])
      );
    }
  }
  return null;
}

/** Watched share of the VOD in 0..1, or null when there is nothing to show. */
function getWatchedFraction(anchor: Element, href: string) {
  const { channelSlug, videoSlug } = getVodSlugs(href);

  let time: number;
  let duration: number | null;
  const progress = readWatchProgress(getProgressKey(channelSlug, videoSlug));
  if (progress) {
    ({ time, duration } = progress);
  } else {
    // Resume positions saved before progress was tracked carry no duration,
    // so take it from the badge Kick draws on the card.
    time = parseFloat(readResumeTime(getResumeKey(channelSlug, videoSlug)));
    duration = readDurationBadge(anchor);
  }

  // Same threshold the player uses before it bothers to resume.
  if (!Number.isFinite(time) || time <= 1 || !duration) return null;
  return Math.min(time / duration, 1);
}

function renderBar(anchor: HTMLElement, href: string) {
  const fraction = getWatchedFraction(anchor, href);
  let bar = anchor.querySelector<HTMLElement>(
    `:scope > .${THUMB_PROGRESS_CLASS}`,
  );

  if (fraction === null) {
    bar?.remove();
    return;
  }

  if (!bar) {
    bar = document.createElement("div");
    bar.className = THUMB_PROGRESS_CLASS;
    bar.appendChild(document.createElement("div"));
    anchor.appendChild(bar);
  }
  (bar.firstElementChild as HTMLElement).style.width = `${fraction * 100}%`;
}

/**
 * Draws the bar on thumbnails that do not have one yet. With `refresh`, every
 * thumbnail is redrawn, for when the stored positions may have moved on.
 */
export function injectThumbnailProgress(refresh = false) {
  const anchors = document.querySelectorAll<HTMLElement>('a[href*="/videos/"]');
  for (const anchor of anchors) {
    const href = anchor.getAttribute("href");
    if (!refresh && anchor.dataset[THUMB_PROGRESS_FLAG] === href) continue;
    if (!href || !VOD_PATH_REGEX.test(href)) continue;
    if (!anchor.querySelector("img")) continue;

    anchor.dataset[THUMB_PROGRESS_FLAG] = href;
    renderBar(anchor, href);
  }
}

export function installThumbnailProgressRefresh() {
  // A VOD watched in another tab writes to the same localStorage, and only
  // the other tabs are told about it.
  window.addEventListener("storage", (event) => {
    // A null key means localStorage was cleared outright.
    if (event.key === null || event.key.startsWith(STORAGE_PREFIX)) {
      injectThumbnailProgress(true);
    }
  });
  // Back from a VOD with SPA navigation off can restore this page from the
  // back/forward cache, bars and all, as they were before the VOD was watched.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) injectThumbnailProgress(true);
  });
}
