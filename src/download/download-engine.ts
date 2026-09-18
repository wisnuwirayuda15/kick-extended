import {
  DOWNLOAD_CONCURRENCY,
  DOWNLOAD_FAILURE_BREAKER,
  DOWNLOAD_PROGRESS_INTERVAL_MS,
  DOWNLOAD_WINDOW,
} from "../constants.ts";
import { state } from "../state.ts";
import { fetchSegmentWithRetry, sleep } from "./segment-fetch.ts";

// The download engine: fetch segments in parallel, write them to disk in order.
//
// This module deliberately imports nothing from player/, native/ or any DOM
// module. A download outlives SPA navigation, so it must not be reachable from
// anything the page teardown touches. The panel subscribes to the engine; the
// engine never reaches back.

/**
 * A wake-all gate.
 *
 * Safe against lost wakeups because JavaScript is single-threaded and there is
 * no await between a waiter checking its condition and calling wait(), so no
 * wake can slip between the two. In a threaded language this would need a lock.
 */
function makeGate() {
  let waiters: any[] = [];
  return {
    wait: () => new Promise<void>((resolve) => waiters.push(resolve)),
    wake: () => {
      const pending = waiters;
      waiters = [];
      for (const resolve of pending) resolve();
    },
  };
}

/** Marks a segment that exhausted its retries, so the writer can count gaps. */
const FAILED: any = Symbol("failed-segment");

/**
 * Runs the fetch/write pipeline to completion, cancellation or breaker trip.
 *
 * THE memory bound lives here. A worker may claim segment `i` only when
 * `i < nextToWrite + WINDOW`, so the only segments that can hold bytes -- in
 * flight or waiting in `done` -- are the WINDOW indices ahead of the write
 * cursor. That caps residency at roughly WINDOW x 10.5 MB regardless of
 * whether the VOD is 20 minutes or 15 hours.
 *
 * Anchoring to `done.size` instead would ignore in-flight fetches, and one slow
 * segment would let the rest of the pool run away and buffer the whole file --
 * exactly the multi-gigabyte failure that streaming to disk exists to avoid.
 */
async function runPipeline(active: any, segments: any[]) {
  const { controller, writable, progress } = active;
  const signal = controller.signal;
  const gate = makeGate();
  const done = new Map<number, any>();

  let nextToFetch = 0;
  let nextToWrite = 0;
  let consecutiveFailures = 0;

  async function worker() {
    for (;;) {
      if (signal.aborted || active.stopReason) return;
      if (nextToFetch >= segments.length) return;

      // The bound. Anchored to the write cursor, never to done.size.
      if (nextToFetch >= nextToWrite + DOWNLOAD_WINDOW) {
        await gate.wait();
        continue;
      }

      // A 429 on any worker parks all of them.
      const pause = progress.throttle.until - Date.now();
      if (pause > 0) {
        await sleep(pause, signal);
        continue;
      }

      const index = nextToFetch++;
      let value: any;
      try {
        value = await fetchSegmentWithRetry(
          segments[index],
          signal,
          progress.throttle,
        );
      } catch (error: any) {
        if (error.name === "AbortError") throw error;
        value = FAILED;
      }
      done.set(index, value);
      gate.wake();
    }
  }

  async function writer() {
    while (nextToWrite < segments.length) {
      if (signal.aborted || active.stopReason) return;

      const value = done.get(nextToWrite);
      if (value === undefined) {
        await gate.wait();
        continue;
      }
      done.delete(nextToWrite);

      if (value === FAILED) {
        progress.gaps.push(nextToWrite);
        // Isolated flakes are survivable and get skipped: a missing 10 s is a
        // PCR discontinuity that mpv and VLC step over. A wall of failures
        // means the playlist is stale and every remaining fetch will fail too.
        consecutiveFailures++;
        if (consecutiveFailures >= DOWNLOAD_FAILURE_BREAKER) {
          active.stopReason = "segments-unavailable";
          gate.wake();
          return;
        }
      } else {
        try {
          // The only backpressure in the system. Not awaiting this queues
          // writes in memory and the bound above evaporates silently -- fine
          // on a short VOD, fatal on a three-hour one.
          await writable.write(value);
        } catch (error: any) {
          // Running out of disk is not retryable; say so rather than letting
          // it surface as a generic failure.
          active.stopReason =
            error && error.name === "QuotaExceededError"
              ? "out-of-space"
              : "write-failed";
          active.stopError = error;
          gate.wake();
          return;
        }
        progress.bytesWritten += value.byteLength;
        consecutiveFailures = 0;
      }

      nextToWrite++;
      progress.segmentsWritten++;
      gate.wake(); // releases window slots
    }
  }

  const workers = [];
  for (let i = 0; i < DOWNLOAD_CONCURRENCY; i++) workers.push(worker());

  // allSettled, not all. On abort the workers reject immediately while the
  // writer may still be inside an un-abortable `await writable.write()`.
  // Promise.all would resolve on the first rejection and let finalize call
  // close() against a pending write, which throws or truncates badly.
  await Promise.allSettled([...workers, writer()]);
}

function computeSnapshot(active: any, ewma: number) {
  const p = active.progress;

  // Percent from segment count, not bytes: the count is exact while the byte
  // total is an estimate, and a bar that drifts past 100 or sticks at 97 reads
  // as broken.
  const percent = p.totalSegments
    ? (p.segmentsWritten / p.totalSegments) * 100
    : 0;

  // Refine the total from what has actually been written. The BANDWIDTH figure
  // in the manifest is a declared peak and runs about 7% high on Kick.
  const estimatedTotalBytes =
    p.segmentsWritten >= 5
      ? (p.bytesWritten / p.segmentsWritten) * p.totalSegments
      : p.estimatedTotalBytes;

  const remaining = Math.max(0, estimatedTotalBytes - p.bytesWritten);

  return {
    status: active.status,
    fileName: active.fileName,
    vodTitle: active.vodTitle,
    bytesWritten: p.bytesWritten,
    estimatedTotalBytes,
    percent,
    bytesPerSecond: ewma,
    // null rather than Infinity, so a view renders "--:--" instead of NaN.
    etaSeconds: ewma > 0 ? remaining / ewma : null,
    segmentsWritten: p.segmentsWritten,
    totalSegments: p.totalSegments,
    gapCount: p.gaps.length,
    stopReason: active.stopReason,
  };
}

function emit(active: any, snapshot: any) {
  active.snapshot = snapshot;
  for (const subscriber of active.subscribers) {
    // A broken view must never take the download down with it.
    try {
      subscriber(snapshot);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Subscribes to a download's progress.
 *
 * Takes the download rather than reading state.activeDownload, because the
 * panel used to be created one line before startDownload() had set it: the
 * subscription silently bound to nothing and the progress bar never moved.
 * Passing it in makes that ordering mistake impossible to express.
 */
export function subscribeToDownload(active: any, fn: any) {
  if (!active) return () => {};
  active.subscribers.add(fn);
  // Replay the last snapshot so a panel mounting mid-download renders real
  // numbers immediately instead of zeros until the next tick.
  if (active.snapshot) fn(active.snapshot);
  return () => active.subscribers.delete(fn);
}

async function finalize(active: any, status: string) {
  clearInterval(active.progressTimer);
  // Removed before the await: closing the tab during the final close() should
  // not prompt.
  window.removeEventListener("beforeunload", active.onBeforeUnload);

  try {
    // close() commits what was written. A truncated MPEG-TS is still playable
    // -- it is self-synchronising, and we only ever stop on a segment
    // boundary, which is keyframe-aligned. abort() would throw away everything
    // already downloaded, which on a cancel near the end is many gigabytes.
    if (active.discard) await active.writable.abort();
    else await active.writable.close();
  } catch {
    /* already closed, or the handle died with the page */
  }

  active.status = status;
  emit(active, computeSnapshot(active, 0));
  state.activeDownload = null;
}

/**
 * Cancels the running download. Idempotent: a second call joins the first
 * rather than closing an already-closed stream.
 */
export function cancelDownload(discard = false) {
  const active = state.activeDownload;
  if (!active) return Promise.resolve();
  if (active.finalizing) return active.finalizing;

  active.status = "cancelling";
  active.discard = discard;
  active.controller.abort();
  emit(active, computeSnapshot(active, 0));
  return active.finalizing || Promise.resolve();
}

/**
 * Starts a download. One at a time: a second pool would double the memory
 * bound and saturate the connection for both.
 */
export async function startDownload(options: any) {
  if (state.activeDownload) return state.activeDownload;

  const {
    fileHandle,
    fileName,
    vodTitle,
    segments,
    initSegment,
    estimatedTotalBytes,
  } = options;

  const writable = await fileHandle.createWritable();
  const controller = new AbortController();

  const active: any = {
    status: "running",
    controller,
    writable,
    fileName,
    vodTitle,
    subscribers: new Set(),
    snapshot: null,
    progressTimer: null,
    finalizing: null,
    discard: false,
    stopReason: null,
    stopError: null,
    onBeforeUnload: (event: any) => {
      // Chromium writes to a .crswap sidecar and only creates the real file on
      // close(), so killing the tab saves nothing at all. Hence the warning.
      event.preventDefault();
      event.returnValue = "";
    },
    progress: {
      bytesWritten: 0,
      segmentsWritten: 0,
      totalSegments: segments.length,
      estimatedTotalBytes: estimatedTotalBytes || 0,
      gaps: [],
      startedAt: Date.now(),
      throttle: { until: 0 },
    },
  };

  state.activeDownload = active;
  window.addEventListener("beforeunload", active.onBeforeUnload);

  let lastBytes = 0;
  let lastTime = performance.now();
  let ewma = 0;
  active.progressTimer = setInterval(() => {
    const now = performance.now();
    const elapsed = (now - lastTime) / 1000;
    if (elapsed > 0) {
      const instant = (active.progress.bytesWritten - lastBytes) / elapsed;
      // A cumulative average understates during ramp-up and never recovers
      // from a stall, so the ETA would stay wrong for the rest of the run.
      ewma = ewma === 0 ? instant : ewma * 0.8 + instant * 0.2;
      lastBytes = active.progress.bytesWritten;
      lastTime = now;
    }
    emit(active, computeSnapshot(active, ewma));
  }, DOWNLOAD_PROGRESS_INTERVAL_MS);

  const run = async () => {
    try {
      // An fMP4 init segment has to lead the file, through the same retry path.
      if (initSegment) {
        const head = await fetchSegmentWithRetry(
          initSegment,
          controller.signal,
          active.progress.throttle,
        );
        await writable.write(head);
        active.progress.bytesWritten += head.byteLength;
      }
      await runPipeline(active, segments);
    } catch {
      /* abort and fatal paths both settle below */
    }

    let status = "done";
    if (controller.signal.aborted) status = "cancelled";
    else if (active.stopReason) status = "failed";

    active.finalizing = finalize(active, status);
    return active.finalizing;
  };

  active.runner = run();
  return active;
}
