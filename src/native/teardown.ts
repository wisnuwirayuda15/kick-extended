export function stopNativePlayback(scope) {
  (scope || document).querySelectorAll("video").forEach((videoElement) => {
    if (videoElement.id === "k-video") return;
    try {
      videoElement.pause();
      videoElement.removeAttribute("src");
      videoElement.load();
    } catch (e) {
      /* the element may already be detached */
    }
  });
}
