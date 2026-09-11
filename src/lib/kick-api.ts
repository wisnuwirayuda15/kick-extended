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
    };
  } catch (e) {
    return null;
  }
}

export async function findStreamUrlFromMetadata(metadata) {
  const { video } = metadata;
  if (!video) return null;

  const thumbUrl =
    video.thumbnail && video.thumbnail.src ? video.thumbnail.src : "";
  const thumbParts = thumbUrl.split("/");
  const idx = thumbParts.indexOf("video_thumbnails");

  if (idx === -1 || idx + 2 >= thumbParts.length) {
    console.error(
      "Kick Unlocker: Could not parse session/segment from thumbnail",
      thumbUrl,
    );
    return null;
  }

  const sessionId = thumbParts[idx + 1];
  const segmentId = thumbParts[idx + 2];

  const startTime = new Date(
    video.start_time.replace(" ", "T") +
      (video.start_time.endsWith("Z") ? "" : "Z"),
  );

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
