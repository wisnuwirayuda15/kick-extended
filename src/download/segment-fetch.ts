import { DOWNLOAD_MAX_ATTEMPTS } from "../constants.ts";

// Fetching one segment, with retry and cancellation. No scheduling here.
//
// Plain fetch() rather than GM_xmlhttpRequest: stream.kick.com answers with
// Access-Control-Allow-Origin: *, so CORS is not in the way, and fetch is the
// only one of the two that streams. GM_xmlhttpRequest with
// responseType: "arraybuffer" would materialise every ~10 MB segment twice.

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Errors are tagged by name rather than by subclass: `erasableSyntaxOnly`
 * rules out the usual class hierarchy, and dispatching on `.name` keeps the
 * abort check and the fatal check the same shape.
 */
function tagged(name: string, message: string) {
  const error: any = new Error(message);
  error.name = name;
  return error;
}

/**
 * setTimeout that loses to an abort.
 *
 * Without this a cancel appears to hang for the length of the backoff. The
 * resolve path removes its listener explicitly: across thousands of segments,
 * leaving them attached to one long-lived signal is a real leak.
 */
export function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Fetches one segment, retrying transient failures.
 *
 * `throttle` is shared across all workers: a 429 on any one of them parks the
 * whole pool until the timestamp passes, which is how concurrency is backed
 * off without restructuring the scheduler.
 */
export async function fetchSegmentWithRetry(
  segment: any,
  signal: AbortSignal,
  throttle: any,
) {
  let lastError: any = null;

  for (let attempt = 0; attempt < DOWNLOAD_MAX_ATTEMPTS; attempt++) {
    // Sleep between attempts, never before the first: a leading sleep would
    // cost a second on every one of a thousand-plus segments.
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1), signal);

    try {
      const response = await fetch(segment.url, {
        signal,
        // ACAO: * is invalid for a credentialed request, and kick.com sets
        // cookies broadly enough that a default fetch to one of its
        // subdomains may attach them and fail CORS.
        credentials: "omit",
        // Without this, gigabytes stream through the HTTP cache and evict
        // everything else in it.
        cache: "no-store",
        headers: segment.range
          ? { Range: `bytes=${segment.range.start}-${segment.range.end}` }
          : undefined,
      });

      if (!response.ok) {
        // Drain the body or the connection is never returned to the pool.
        // Eight workers leaking sockets exhaust the per-host limit and the
        // download deadlocks with no error at all.
        response.body?.cancel();

        if (response.status === 429) {
          const retryAfter = parseInt(
            response.headers.get("Retry-After") || "",
            10,
          );
          throttle.until =
            Date.now() +
            (Number.isFinite(retryAfter) ? retryAfter * 1000 : 5000);
          lastError = tagged("HttpError", "HTTP 429");
          continue;
        }
        if (RETRYABLE_STATUS.has(response.status)) {
          lastError = tagged("HttpError", `HTTP ${response.status}`);
          continue;
        }
        // 404/403/410/401: the segment is genuinely gone. Three more attempts
        // would spend seven seconds reaching the same answer.
        throw tagged("FatalSegmentError", `HTTP ${response.status}`);
      }

      // Inside the try on purpose: headers can arrive with a 200 and the
      // connection still drop mid-body, which is a retryable network failure
      // rather than a success.
      return new Uint8Array(await response.arrayBuffer());
    } catch (error: any) {
      // Order is load-bearing. Classify an abort as a network failure and the
      // worker sleeps, retries against an already-aborted signal, and the
      // download limps on for seconds after the user cancelled.
      if (error.name === "AbortError") throw error;
      if (error.name === "FatalSegmentError") throw error;
      lastError = error;
    }
  }

  throw tagged(
    "ExhaustedError",
    `${segment.url}: ${lastError ? lastError.message : "unknown"}`,
  );
}
