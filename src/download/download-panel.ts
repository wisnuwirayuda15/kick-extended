import { DOWNLOAD_PANEL_ID } from "../constants.ts";
import { formatTime } from "../lib/format.ts";
import { cancelDownload, subscribeToDownload } from "./download-engine.ts";

// Progress panel for a running download.
//
// Fixed on <body>, like #k-toast, and deliberately NOT removed by
// destroyCustomPlayer. A download outlives SPA navigation, so its UI has to as
// well: anything anchored inside #k-player or next to Kick's Subscribe button
// would be torn out on the first route change.

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

function describe(snapshot: any) {
  if (snapshot.status === "running") {
    const rate = snapshot.bytesPerSecond
      ? ` · ${(snapshot.bytesPerSecond / 1024 ** 2).toFixed(1)} MB/s`
      : "";
    const eta =
      snapshot.etaSeconds === null
        ? " · --:--"
        : ` · ${formatTime(snapshot.etaSeconds)} left`;
    return (
      `${formatBytes(snapshot.bytesWritten)} of ` +
      `~${formatBytes(snapshot.estimatedTotalBytes)}${rate}${eta}`
    );
  }
  if (snapshot.status === "cancelling") return "Finishing the current segment…";

  const written = `${snapshot.segmentsWritten} of ${snapshot.totalSegments} segments`;
  // Never report a gapped download as a clean success: the file is short by
  // roughly 10 seconds per gap and the user has no other way to find out.
  const gaps = snapshot.gapCount
    ? ` · ${snapshot.gapCount} gap${snapshot.gapCount === 1 ? "" : "s"} (~${Math.round(snapshot.gapCount * 10)} s missing)`
    : "";

  if (snapshot.status === "cancelled")
    return `Cancelled — kept ${written}${gaps}`;
  if (snapshot.status === "failed") {
    const why =
      snapshot.stopReason === "out-of-space"
        ? "ran out of disk space"
        : snapshot.stopReason === "segments-unavailable"
          ? "segments stopped responding"
          : "write failed";
    return `Stopped (${why}) — kept ${written}${gaps}`;
  }
  return `Done — ${written}${gaps}`;
}

export function showDownloadPanel() {
  document.getElementById(DOWNLOAD_PANEL_ID)?.remove();

  const panel = document.createElement("div");
  panel.id = DOWNLOAD_PANEL_ID;

  const title = document.createElement("div");
  title.className = "k-dl-panel-title";

  const bar = document.createElement("div");
  bar.className = "k-dl-bar";
  const fill = document.createElement("div");
  fill.className = "k-dl-bar-fill";
  bar.appendChild(fill);

  const detail = document.createElement("div");
  detail.className = "k-dl-panel-detail";

  const action = document.createElement("button");
  action.type = "button";
  action.className = "k-dl-panel-action";

  panel.append(title, bar, detail, action);
  document.body.appendChild(panel);

  let unsubscribe: any = null;
  const dismiss = () => {
    if (unsubscribe) unsubscribe();
    panel.remove();
  };

  const render = (snapshot: any) => {
    // The download may well belong to a VOD the user has since navigated away
    // from, so the panel names it rather than letting the bar read as the page
    // currently on screen.
    title.textContent = snapshot.vodTitle || snapshot.fileName;
    fill.style.width = `${Math.min(100, snapshot.percent).toFixed(1)}%`;
    detail.textContent = describe(snapshot);

    const finished =
      snapshot.status === "done" ||
      snapshot.status === "cancelled" ||
      snapshot.status === "failed";
    panel.dataset.state = snapshot.status;
    action.textContent = finished ? "Close" : "Cancel";
    action.disabled = snapshot.status === "cancelling";
  };

  action.addEventListener("click", () => {
    const finished = ["done", "cancelled", "failed"].includes(
      panel.dataset.state || "",
    );
    if (finished) dismiss();
    else cancelDownload();
  });

  unsubscribe = subscribeToDownload(render);
  return panel;
}
