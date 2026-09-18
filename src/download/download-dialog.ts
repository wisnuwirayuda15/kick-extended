import { DOWNLOAD_DIALOG_ID } from "../constants.ts";
import { resolveStream } from "../lib/kick-api.ts";
import { getVodSlugs } from "../lib/vod-slugs.ts";
import { makeVideoTitle } from "../player/external.ts";
import { state } from "../state.ts";
import { startDownload } from "./download-engine.ts";
import { showDownloadPanel } from "./download-panel.ts";
import { buildDownloadUrl } from "./download-url.ts";
import { canStreamToDisk, getPickerHost } from "./fs-access.ts";
import { parseMasterPlaylist, parseMediaPlaylist } from "./m3u8.ts";

// The download dialog: pick a quality, see what it will cost, start.
//
// Body-level and modal rather than a dropdown, because it must outlive
// #k-player and escape the @container queries, which only apply inside it.

function formatSize(bytes: number) {
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${Math.round(bytes / 1024 ** 2)} MB`;
}

async function fetchText(url: string) {
  const response = await fetch(url, { credentials: "omit", cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export function openDownloadDialog(options: any = {}) {
  const pathname = options.pathname || window.location.pathname;
  const pageUrl = options.pageUrl || window.location.href;
  document.getElementById(DOWNLOAD_DIALOG_ID)?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = DOWNLOAD_DIALOG_ID;

  const dialog = document.createElement("div");
  dialog.className = "k-dl-dialog";
  backdrop.appendChild(dialog);

  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (event: any) => {
    if (event.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });

  const heading = document.createElement("div");
  heading.className = "k-dl-heading";
  heading.textContent = "Download VOD";

  const body = document.createElement("div");
  body.className = "k-dl-body";
  body.textContent = "Resolving stream…";

  const footer = document.createElement("div");
  footer.className = "k-dl-footer";

  // The escape hatch, always present: if the built-in downloader fails on some
  // VOD there is still something that works.
  const handoff = document.createElement("button");
  handoff.type = "button";
  handoff.className = "k-dl-secondary";
  handoff.textContent = "Use kick-video.download";
  handoff.addEventListener("click", () => {
    window.open(buildDownloadUrl(pageUrl), "_blank", "noopener");
    close();
  });
  footer.appendChild(handoff);

  dialog.append(heading, body, footer);
  document.body.appendChild(backdrop);

  load(body, footer, pathname, close);
  return backdrop;
}

async function load(body: any, footer: any, pathname: string, close: any) {
  const { channelSlug, videoSlug, cacheKey } = getVodSlugs(pathname);
  if (!channelSlug || !videoSlug) {
    body.textContent = "This does not look like a VOD page.";
    return;
  }

  try {
    // Same cache and guard the copy-URL button and the native dropdown use, so
    // opening this after either of them is free. A cold resolve probes up to
    // 33 URLs sequentially.
    if (state.nativeExternalCache?.key !== cacheKey) {
      const resolved = await resolveStream(channelSlug, videoSlug);
      if (!resolved) {
        body.textContent = "Stream not found.";
        return;
      }
      state.nativeExternalCache = { key: cacheKey, ...resolved };
    }
    const cache = state.nativeExternalCache;

    const variants = parseMasterPlaylist(
      await fetchText(cache.streamUrl),
      cache.streamUrl,
    );
    if (!variants.length) {
      body.textContent = "No qualities found in the playlist.";
      return;
    }

    // One media playlist gives the duration, which is the same across
    // variants, so every size estimate follows from BANDWIDTH x duration
    // without fetching the rest.
    const reference = parseMediaPlaylist(
      await fetchText(variants[0].url),
      variants[0].url,
    );
    const duration = reference.duration;

    render(body, footer, variants, duration, cache, close);
  } catch (error: any) {
    body.textContent = `Could not read the playlist: ${error.message}`;
  }
}

function render(
  body: any,
  footer: any,
  variants: any[],
  duration: number,
  cache: any,
  close: any,
) {
  body.textContent = "";
  const available = canStreamToDisk();

  if (!available) {
    const note = document.createElement("div");
    note.className = "k-dl-note";
    note.textContent =
      "This browser cannot save large files directly to disk " +
      "(the File System Access API is Chromium-only), so the built-in " +
      "downloader is unavailable here. The link below still works.";
    body.appendChild(note);
  }

  const list = document.createElement("div");
  list.className = "k-dl-qualities";

  // 720p60 by default, not the highest: 4.4 GB against 11.3 GB for three
  // hours, and for a VOD that is usually the better trade.
  let selected =
    variants.find((v) => v.height === 720) ||
    variants[Math.min(1, variants.length - 1)];

  for (const variant of variants) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "k-dl-quality";
    option.disabled = !available;

    const label = variant.name || `${variant.height}p`;
    const mbps = (variant.bandwidth / 1e6).toFixed(1);
    const size = formatSize((variant.bandwidth / 8) * duration);
    option.textContent = `${label} · ${mbps} Mbps · ~${size}`;

    option.addEventListener("click", () => {
      selected = variant;
      for (const el of list.children) el.classList.remove("active");
      option.classList.add("active");
    });
    if (variant === selected) option.classList.add("active");
    list.appendChild(option);
  }
  body.appendChild(list);

  if (!available) return;

  const start = document.createElement("button");
  start.type = "button";
  start.className = "k-dl-primary";
  start.textContent = "Download";
  start.addEventListener("click", async () => {
    const host = getPickerHost();
    if (!host) return;

    const title = makeVideoTitle(cache.result);
    let handle: any;
    try {
      // First statement on the click. Transient user activation lasts about
      // five seconds, and everything slow already happened while the dialog
      // was loading, so nothing is allowed to creep in ahead of this.
      handle = await host.showSaveFilePicker({
        suggestedName: `${title}.ts`,
        types: [
          {
            description: "MPEG transport stream",
            accept: { "video/mp2t": [".ts"] },
          },
        ],
      });
    } catch {
      return; // the user dismissed the picker
    }

    start.disabled = true;
    start.textContent = "Reading playlist…";
    try {
      const media = parseMediaPlaylist(
        await fetchText(selected.url),
        selected.url,
      );
      close();
      const active = await startDownload({
        fileHandle: handle,
        fileName: `${title}.ts`,
        vodTitle: title,
        segments: media.segments,
        initSegment: media.initSegment,
        estimatedTotalBytes: (selected.bandwidth / 8) * media.duration,
      });
      showDownloadPanel(active);
    } catch (error: any) {
      start.disabled = false;
      start.textContent = "Download";
      body.appendChild(
        Object.assign(document.createElement("div"), {
          className: "k-dl-note",
          textContent: `Could not start: ${error.message}`,
        }),
      );
    }
  });
  footer.insertBefore(start, footer.firstChild);
}
