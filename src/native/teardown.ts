// Kick's player does not die with its <video>.
//
// Pausing the element and wiping the container is not enough: Kick's player
// code keeps a reference to the element, and when the auto-switch fires
// before that player has finished loading, it goes on to attach a source and
// call play() on the now-detached element. A detached <video> still plays
// audio, so the VOD is heard twice. React can also mount a fresh native
// <video> that starts on its own.
//
// So once Kick's player has been torn down for this page, every native video
// is held silent until releaseNativePlayback() hands the page back.

let guarding = false;

// Muted state each held element had before we touched it, so release can put
// it back: Kick may reuse the element after an SPA navigation.
const held = new Map<HTMLVideoElement, boolean>();

function isNativeVideo(target: EventTarget | null): target is HTMLVideoElement {
  return target instanceof HTMLVideoElement && target.id !== "k-video";
}

function hush(video: HTMLVideoElement) {
  if (!guarding) return;
  if (!held.has(video)) held.set(video, video.muted);
  video.muted = true;
  try {
    video.pause();
  } catch (e) {
    /* the element may already be detached */
  }
}

function onPlay(event: Event) {
  if (isNativeVideo(event.target)) hush(event.target);
}

export function stopNativePlayback(scope) {
  guarding = true;
  (scope || document).querySelectorAll("video").forEach((videoElement) => {
    if (!isNativeVideo(videoElement)) return;
    hush(videoElement);
    // Media events do not propagate out of a detached element, so the
    // document-level guard cannot see these once the container is wiped.
    videoElement.addEventListener("play", onPlay);
    videoElement.addEventListener("playing", onPlay);
    try {
      videoElement.removeAttribute("src");
      videoElement.load();
    } catch (e) {
      /* the element may already be detached */
    }
  });
}

/** Called when the custom player is torn down: Kick's player may play again. */
export function releaseNativePlayback() {
  guarding = false;
  held.forEach((wasMuted, video) => {
    video.removeEventListener("play", onPlay);
    video.removeEventListener("playing", onPlay);
    video.muted = wasMuted;
  });
  held.clear();
}

// Media events do not bubble, but they do pass through the capture phase, so
// one listener on document sees every connected <video> that starts playing,
// including one React mounts after the teardown.
export function installNativePlaybackGuard() {
  document.addEventListener("play", onPlay, true);
  document.addEventListener("playing", onPlay, true);
}
