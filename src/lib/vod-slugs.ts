// VOD path parsing, in one place.
//
// Kick VOD paths are /{channel}/videos/{id}, with /video/ accepted as an older
// singular spelling (see VOD_PATH_REGEX). Index 2 is the id under both.
//
// The cache key is built here too, not by each caller: everything that reads
// state.nativeExternalCache has to produce a byte-identical key or it silently
// misses the cache and re-resolves, which costs up to 33 sequential HEAD probes.

export function getVodSlugs(pathname = window.location.pathname) {
  const pathParts = pathname.split("/").filter(Boolean);
  const channelSlug = pathParts[0];
  const videoSlug = pathParts[2];
  return { channelSlug, videoSlug, cacheKey: `${channelSlug}/${videoSlug}` };
}
