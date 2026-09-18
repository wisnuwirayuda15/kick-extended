// The saved filename: "(1080p60) Video title - Channel.ts".
//
// Deliberately not folded into makeVideoTitle: that one also feeds the .m3u
// playlist handoff and the external-player menu, where a resolution and a
// channel name would be wrong.

/** The characters a Windows filename may not contain. */
const ILLEGAL = /[\\/:*?"<>|]/g;

function clean(value: any, limit: number) {
  return String(value || "")
    .replace(ILLEGAL, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit)
    .trim();
}

/**
 * Builds the download filename, omitting any part the VOD does not have
 * rather than emitting an empty "()" or a dangling " - ".
 *
 * Each part is capped separately instead of truncating the finished string,
 * so a long title cannot push the channel name off the end. The caps also
 * keep the total well inside the 255-character limit filesystems put on a
 * single name -- a Kick VOD title alone can run to several hundred.
 */
export function makeDownloadFileName(parts: any) {
  const resolution = clean(parts.resolution, 12);
  const title = clean(parts.title, 80) || "kick-vod";
  const channel = clean(parts.channel, 40);

  let name = title;
  if (channel) name += ` - ${channel}`;
  if (resolution) name = `(${resolution}) ${name}`;

  // Windows silently drops a trailing dot or space, which would leave the file
  // named something the script never chose.
  return name.replace(/[. ]+$/, "") || "kick-vod";
}
