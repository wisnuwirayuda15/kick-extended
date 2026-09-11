/**
 * The single place the third-party download service is named.
 *
 * Both entry points go through here. The two merged scripts each had their own
 * call site, so the URL was built in two places; now it is built in one.
 *
 * kick-video.download is a third-party service, not part of this project.
 */
export function buildDownloadUrl(videoUrl) {
  return `https://kick-video.download/?download=${encodeURIComponent(videoUrl)}`;
}
