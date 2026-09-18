// Minimal HLS playlist parsing, enough to drive a downloader.
//
// hls.js already parses playlists for the custom player, but it does so as a
// side effect of mounting a media element and buffering. The downloader needs
// the segment list without any of that, so it parses the playlists itself.
//
// Both functions are pure: text in, data out, no fetching.

/**
 * Splits an HLS attribute list.
 *
 * A plain split on "," is wrong, because a quoted value may contain one:
 *   CODECS="avc1.64002A,mp4a.40.2"
 * Treating a quoted value as atomic is the whole reason this is a regex.
 */
function parseAttributes(line: string) {
  const attributes: any = {};
  const pattern = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
  let match: any;
  while ((match = pattern.exec(line)) !== null) {
    attributes[match[1]] = match[2].replace(/^"|"$/g, "");
  }
  return attributes;
}

/**
 * Master playlist -> the variant list, highest bandwidth first.
 *
 * Each #EXT-X-STREAM-INF is followed by its URI on the next non-comment line.
 */
export function parseMasterPlaylist(text: string, playlistUrl: string) {
  const variants: any[] = [];
  let pending: any = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const attributes = parseAttributes(line);
      const [width, height] = String(attributes.RESOLUTION || "x").split("x");
      pending = {
        bandwidth: parseInt(attributes.BANDWIDTH, 10) || 0,
        width: parseInt(width, 10) || 0,
        height: parseInt(height, 10) || 0,
        frameRate: parseFloat(attributes["FRAME-RATE"]) || 0,
        codecs: attributes.CODECS || "",
        // Kick emits no NAME; it labels variants with VIDEO="1080p60",
        // which is what its own quality menu shows.
        name: attributes.NAME || attributes.VIDEO || "",
      };
    } else if (!line.startsWith("#") && pending) {
      pending.url = new URL(line, playlistUrl).href;
      variants.push(pending);
      pending = null;
    }
  }

  return variants.sort((a, b) => b.bandwidth - a.bandwidth);
}

/**
 * Media playlist -> ordered segments plus total duration.
 *
 * Throws on an encrypted playlist. Concatenating AES-128 segments would
 * produce a file of exactly the right size that is completely unplayable,
 * which is a worse outcome than refusing.
 */
export function parseMediaPlaylist(text: string, playlistUrl: string) {
  const segments: any[] = [];
  let duration = 0;
  let initSegment: any = null;
  let pendingDuration = 0;
  let pendingRange: any = null;
  // EXT-X-BYTERANGE's offset is optional; when omitted the range continues
  // from the end of the previous one.
  let rangeCursor = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      pendingDuration = parseFloat(line.slice("#EXTINF:".length)) || 0;
    } else if (line.startsWith("#EXT-X-BYTERANGE:")) {
      const [length, offset] = line
        .slice("#EXT-X-BYTERANGE:".length)
        .split("@");
      const start = offset !== undefined ? parseInt(offset, 10) : rangeCursor;
      rangeCursor = start + parseInt(length, 10);
      pendingRange = { start, end: rangeCursor - 1 };
    } else if (line.startsWith("#EXT-X-MAP:")) {
      const attributes = parseAttributes(line);
      const [length, offset] = String(attributes.BYTERANGE || "").split("@");
      const start = parseInt(offset, 10) || 0;
      initSegment = {
        url: new URL(attributes.URI, playlistUrl).href,
        range: length ? { start, end: start + parseInt(length, 10) - 1 } : null,
      };
    } else if (line.startsWith("#EXT-X-KEY:")) {
      if (parseAttributes(line).METHOD !== "NONE") {
        throw new Error("Encrypted playlists are not supported");
      }
    } else if (!line.startsWith("#")) {
      segments.push({
        url: new URL(line, playlistUrl).href,
        duration: pendingDuration,
        range: pendingRange,
      });
      duration += pendingDuration;
      pendingDuration = 0;
      pendingRange = null;
    }
    // #EXT-X-DISCONTINUITY is ignored on purpose: a concatenated transport
    // stream containing one is exactly what mpv and VLC expect.
  }

  return { segments, duration, initSegment };
}
