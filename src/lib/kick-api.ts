import { checkStreamUrl, gmFetch } from "./gm-fetch.ts";

export async function getVideoMetadata(channelSlug, videoSlug) {
  try {
    const chRes = await gmFetch(
      `https://kick.com/api/v2/channels/${channelSlug}`,
    );
    if (!chRes.ok) return null;
    const chData = chRes.json();
    const channelId = chData.id;

    const vidRes = await gmFetch(
      `https://web.kick.com/api/v1/channels/${channelId}/videos`,
      {
        headers: {
          Accept: "application/json",
          "Alt-Used": "web.kick.com",
          Origin: "https://kick.com",
          Referer: "https://kick.com/",
        },
      },
    );
    if (!vidRes.ok) return null;

    const vidData = vidRes.json();
    let videosList = vidData.data || vidData.videos || [];
    if (Array.isArray(vidData)) videosList = vidData;

    const targetVideo = videosList.find((v) => String(v.id) === videoSlug);
    if (!targetVideo) return null;

    return {
      video: targetVideo,
      channelId: channelId,
      channelSlug: channelSlug,
      // Display-cased ("xQc") where the slug is lowercase ("xqc"). Kept for
      // the download filename; falls back rather than risking undefined.
      channelName: chData.user?.username || chData.slug || channelSlug,
    };
  } catch (e) {
    return null;
  }
}

// Kick's API returns start times both as "2026-09-27 19:47:21" and as
// "2026-09-27T19:47:21Z"; both are UTC.
function parseStartTime(value) {
  const text = String(value || "").replace(" ", "T");
  return new Date(text + (text.endsWith("Z") ? "" : "Z"));
}

// Legacy thumbnails live at images.kick.com/video_thumbnails/<session>/<segment>/,
// which is exactly the IVS path pair the stream URL is built from.
function parseIvsThumbnail(thumbUrl) {
  const parts = String(thumbUrl || "").split("/");
  const idx = parts.indexOf("video_thumbnails");
  if (idx === -1 || idx + 2 >= parts.length) return null;
  return { sessionId: parts[idx + 1], segmentId: parts[idx + 2] };
}

// Since Kick's 2026-09-21 platform change, new VODs are recorded under a
// random IVS path. The kick.com web player now asks for a signed master
// playlist instead, and this mirrors that request. Kick rejects the call with
// 400 unless the whole player payload is present, so none of it is optional.
// Returns null when no URL is minted, e.g. a subscriber-only VOD without an
// entitled session.
async function mintPlaybackUrl(videoId, channelSlug) {
  try {
    const res = await gmFetch(
      `https://web.kick.com/api/v1/stream/${videoId}/playback`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Origin: "https://kick.com",
          Referer: "https://kick.com/",
        },
        body: JSON.stringify({
          video_player: {
            player: {
              player_name: "web",
              player_version: "1.0.0",
              player_software: "IVS Player",
              player_software_version: "1.28.0",
            },
            mux_sdk: { sdk_available: false },
            pal_sdk: { sdk_available: false, nonce: "" },
            datazoom_sdk: {
              sdk_available: false,
              datazoom_sdk_version: "",
              om_sdk_version: "",
            },
            google_ads_sdk: { sdk_available: false },
          },
          video_session: {
            page_type: "vod",
            player_remote_played: false,
            enable_sampling: false,
            url_path: `/${channelSlug}/videos/${videoId}`,
            autoplay_behaviour: "auto",
            play_muted: false,
            viewer_connection_type: "",
          },
          user_session: {
            session_id: "",
            player_device_id: "unknown",
            browser_lang: navigator.language || "en-US",
            non_personalised_ads: false,
            ad_targeting: "",
          },
        }),
      },
    );
    if (!res.ok) return null;
    return res.json()?.playback_url?.vod || null;
  } catch (e) {
    return null;
  }
}

// New VODs' thumbnails (web.kick.com/api/v1/videos/...) no longer carry the
// IVS path, but the v1 channel endpoint's previous_livestreams still serves
// legacy thumbnails. Same recording, same start time, so match on that.
async function findLegacyThumbnail(channelSlug, startTime) {
  try {
    const res = await gmFetch(
      `https://kick.com/api/v1/channels/${channelSlug}`,
    );
    if (!res.ok) return "";
    const livestreams = res.json().previous_livestreams || [];
    const match = livestreams.find(
      (entry) =>
        parseStartTime(entry.start_time).getTime() === startTime.getTime(),
    );
    return match?.thumbnail?.src || "";
  } catch (e) {
    return "";
  }
}

export async function findStreamUrlFromMetadata(metadata) {
  const { video, channelSlug } = metadata;
  if (!video) return null;

  const minted = await mintPlaybackUrl(video.id, channelSlug);
  if (minted) return minted;

  // Not minted: fall back to probing the IVS path directly. The segments are
  // not entitlement-gated, which is what keeps subscriber-only VODs working.
  const startTime = parseStartTime(video.start_time);
  const thumbUrl =
    video.thumbnail && video.thumbnail.src ? video.thumbnail.src : "";
  const ivs =
    parseIvsThumbnail(thumbUrl) ||
    parseIvsThumbnail(await findLegacyThumbnail(channelSlug, startTime));

  if (!ivs) {
    console.error(
      "Kick Unlocker: Could not parse session/segment from thumbnail",
      thumbUrl,
    );
    return null;
  }

  const { sessionId, segmentId } = ivs;

  const baseUrls = [
    "https://stream.kick.com/ivs/v1/196233775518",
    "https://stream.kick.com/3c81249a5ce0/ivs/v1/196233775518",
    "https://stream.kick.com/0f3cb0ebce7/ivs/v1/196233775518",
  ];

  const tasks = [];
  const offsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];

  for (const offset of offsets) {
    const t = new Date(startTime.getTime() + offset * 60000);
    const y = t.getUTCFullYear();
    const m = t.getUTCMonth() + 1;
    const d = t.getUTCDate();
    const h = t.getUTCHours();
    const min = t.getUTCMinutes();

    for (const base of baseUrls) {
      tasks.push(
        `${base}/${sessionId}/${y}/${m}/${d}/${h}/${min}/${segmentId}/media/hls/master.m3u8`,
      );
    }
  }
  for (const url of tasks) {
    if (await checkStreamUrl(url)) return url;
  }
  return null;
}

export async function resolveStream(channelSlug, videoSlug) {
  try {
    const result = await getVideoMetadata(channelSlug, videoSlug);
    if (!result) return null;
    const streamUrl = await findStreamUrlFromMetadata(result);
    if (!streamUrl) return null;
    return { result, streamUrl };
  } catch (e) {
    return null;
  }
}
