import {
  KICK_MENU_SELECTOR,
  PROGRESS_MENU_FLAG,
  PROGRESS_MENU_ITEM_CLASS,
  STORAGE_PREFIX,
  THUMB_PROGRESS_CLASS,
  THUMB_PROGRESS_FLAG,
  VOD_PATH_REGEX,
} from "../constants.ts";
import { icon } from "../icons.ts";
import {
  clearResumeTime,
  clearWatchProgress,
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

function findVodThumbnails(root: ParentNode) {
  return [...root.querySelectorAll<HTMLElement>('a[href*="/videos/"]')].filter(
    (anchor) => {
      const href = anchor.getAttribute("href");
      return href && VOD_PATH_REGEX.test(href) && anchor.querySelector("img");
    },
  );
}

/**
 * Draws the bar on thumbnails that do not have one yet. With `refresh`, every
 * thumbnail is redrawn, for when the stored positions may have moved on.
 */
export function injectThumbnailProgress(refresh = false) {
  for (const anchor of findVodThumbnails(document)) {
    const href = anchor.getAttribute("href")!;
    if (!refresh && anchor.dataset[THUMB_PROGRESS_FLAG] === href) continue;
    anchor.dataset[THUMB_PROGRESS_FLAG] = href;
    renderBar(anchor, href);
  }
}

/**
 * The thumbnail of the card a menu trigger sits in. The first ancestor that
 * holds any thumbnail is the card, unless it holds several VODs: then the
 * trigger was not in a card at all, and that ancestor is a whole grid.
 */
function findCardThumbnail(trigger: Element) {
  for (let node = trigger.parentElement; node; node = node.parentElement) {
    const thumbnails = findVodThumbnails(node);
    if (!thumbnails.length) continue;
    const hrefs = new Set(thumbnails.map((a) => a.getAttribute("href")));
    return hrefs.size === 1 ? thumbnails[0] : null;
  }
  return null;
}

function createMenuItem(menu: Element, href: string) {
  const item = document.createElement("button");
  item.type = "button";
  item.setAttribute("role", "menuitem");
  item.tabIndex = -1;
  // Borrowed from Kick's own item, so it looks and hovers like the rest.
  const sibling = menu.querySelector('[role="menuitem"]');
  item.className = `${sibling?.className || ""} ${PROGRESS_MENU_ITEM_CLASS}`;
  item.innerHTML = `${icon("history", 'width="20" height="20" class="inline-block shrink-0"')}<span>Remove watch progress</span>`;

  item.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const { channelSlug, videoSlug } = getVodSlugs(href);
    clearWatchProgress(getProgressKey(channelSlug, videoSlug));
    // The bar falls back to the resume position, so that has to go too.
    clearResumeTime(getResumeKey(channelSlug, videoSlug));
    injectThumbnailProgress(true);
    // Radix only closes on items it manages itself. Escape is what its
    // dismiss handler listens for on the document.
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
  return item;
}

/** Adds "Remove watch progress" to an open card menu, if it has any. */
export function injectProgressMenuItem() {
  for (const menu of document.querySelectorAll<HTMLElement>(
    KICK_MENU_SELECTOR,
  )) {
    // Once per menu, whatever the outcome. Radix mounts a fresh one on every
    // open, and a menu that is not a card's would otherwise rescan the page
    // on each mutation while it stays open.
    if (menu.dataset[PROGRESS_MENU_FLAG]) continue;
    menu.dataset[PROGRESS_MENU_FLAG] = "true";

    const trigger = document.getElementById(
      menu.getAttribute("aria-labelledby")!,
    );
    const thumbnail = trigger && findCardThumbnail(trigger);
    if (!thumbnail) continue;

    // Offered only where there is something to remove: the bar is showing.
    const href = thumbnail.getAttribute("href")!;
    if (getWatchedFraction(thumbnail, href) === null) continue;
    menu.appendChild(createMenuItem(menu, href));
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
