import {
  BADGE_SELECTOR,
  CHANNEL_NAME_SELECTOR,
  NATIVE_VIDEO_FALLBACK_SELECTOR,
  NATIVE_VIDEO_SELECTOR,
  PLAYER_CONTAINER_SELECTOR,
  VIDEOS_LIST_PATH_REGEX,
  VOD_PATH_REGEX,
} from "../constants.ts";

export function isVodPage() {
  return VOD_PATH_REGEX.test(window.location.pathname);
}

export function isVideosListPage() {
  return VIDEOS_LIST_PATH_REGEX.test(window.location.pathname);
}

export function getNativeVideo() {
  const byId = document.querySelector(NATIVE_VIDEO_SELECTOR);
  if (byId && byId.id !== "k-video") return byId;
  return document.querySelector(NATIVE_VIDEO_FALLBACK_SELECTOR);
}

// Kick renders the <video> tag before it is laid out, so element presence
// alone is a bad signal. The control bar is no help either: it is only
// mounted on hover. Size is. Waiting for readyState as well only held the
// auto-switch up until Kick had started loading a stream it was about to lose.
export function isNativePlayerVisible() {
  const nativeVideo: any = getNativeVideo();
  if (!nativeVideo) return false;

  const rect = nativeVideo.getBoundingClientRect();
  return rect.width >= 120 && rect.height >= 70;
}

export function findCopyButtonAnchor() {
  const badge = document.querySelector(BADGE_SELECTOR);
  if (badge?.parentElement) return badge;
  return document.querySelector(CHANNEL_NAME_SELECTOR);
}

export function findNativePlayerContainer() {
  const nativeVideo = getNativeVideo();
  if (!nativeVideo) return null;

  // Kick's Tailwind classes churn between deploys, so this may miss.
  const classMatch = nativeVideo.closest(PLAYER_CONTAINER_SELECTOR);
  if (classMatch) return classMatch;

  // Fallback: climb while each ancestor still hugs the video box. The
  // control overlay is absolutely positioned inside that same box, so the
  // last tight-fitting ancestor is the player root. The first one that
  // grows noticeably is page chrome and must not be wiped.
  const videoRect = nativeVideo.getBoundingClientRect();
  let node = nativeVideo.parentElement;
  let bestMatch = nativeVideo.parentElement;

  while (node && node !== document.body) {
    const rect = node.getBoundingClientRect();
    if (
      rect.width > videoRect.width * 1.15 ||
      rect.height > videoRect.height * 1.3
    )
      break;
    bestMatch = node;
    node = node.parentElement;
  }

  return bestMatch;
}
