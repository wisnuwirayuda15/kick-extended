# Built-in downloader — feasibility research

Investigation for Phase 7: replacing the `kick-video.download` handoff with a
downloader built into the script.

**Recommendation: build Stage A. Skip Stage B for now.** One blocker needs a
five-minute in-browser check before any code is written — see §2.

Everything below was measured against a real Kick VOD on 2026-09-18, not
estimated. Test subject: a public 14.77-hour 1080p60 VOD (5,315 segments),
chosen as a worst case against the ">3 hours" target.

---

## Summary

| #   | Question          | Verdict                                                                            |
| --- | ----------------- | ---------------------------------------------------------------------------------- |
| 1   | Size              | **Worse than assumed.** 11.3 GB for 3h at 1080p60. In-memory is impossible.        |
| 2   | Streaming to disk | **Works, Chromium desktop only** (~31% of browsers). One unverified detail.        |
| 3   | Fetching segments | **Plain `fetch()` works.** `Access-Control-Allow-Origin: *` confirmed.             |
| 4   | Container         | **MPEG-TS confirmed. No CSP on kick.com at all** — the expected blocker is absent. |
| 5   | Audio             | **Muxed in.** Concat-only will not be silent.                                      |
| 6   | Rate limiting     | **None observed.** Zero failures up to 24 concurrent.                              |

The item flagged as "most likely to kill the feature" — CSP blocking a remuxer —
turned out not to apply. The real constraint is file size, and it kills
`ffmpeg.wasm` rather than the feature.

---

## 1. Size

Measured on the 1080p60 rendition, sampling segments across the whole VOD:

| Sample    | Bytes      |
| --------- | ---------- |
| `0.ts`    | 10,529,880 |
| `100.ts`  | 10,563,156 |
| `1000.ts` | 10,507,508 |
| `2500.ts` | 10,372,712 |
| `5000.ts` | 10,658,660 |

Average **10.53 MB** per segment, average segment length **10.01 s** →
**8.41 Mbps** actual (the manifest declares `BANDWIDTH=9014863`).

Projected output size:

| Duration | 1080p60     | 720p60  | 480p30 | 360p30 | 160p30 |
| -------- | ----------- | ------- | ------ | ------ | ------ |
| 1 h      | 3.8 GB      | 1.5 GB  | 0.6 GB | 0.3 GB | 0.1 GB |
| **3 h**  | **11.3 GB** | 4.4 GB  | 1.9 GB | 0.8 GB | 0.3 GB |
| 6 h      | 22.7 GB     | 8.8 GB  | 3.7 GB | 1.6 GB | 0.6 GB |
| 14.77 h  | 55.8 GB     | 21.6 GB | 9.2 GB | 3.9 GB | 1.4 GB |

The measured VOD comes to **52.1 GB** at 1080p60 across its 5,315 segments.

> The brief guessed "several GB" for a three-hour 1080p VOD. It is **11.3 GB** —
> roughly triple. This changes nothing about the design, but it does mean disk
> space needs saying out loud in the UI, and that a 720p default is the kinder
> choice.

**In-memory ceiling.** Accumulating into a `Blob` is not viable at any useful
length. A single `ArrayBuffer` is capped well below these sizes, and the
practical ceiling before the tab dies is on the order of **1 GB**, i.e. about
15 minutes of 1080p60. Streaming to disk is not an optimisation here, it is the
only thing that works.

## 2. Streaming to disk — the File System Access API

`showSaveFilePicker()` plus a `WritableStream` is the right mechanism, and it
keeps memory flat regardless of VOD length.

**Browser support** (caniuse, ~30.85% of global usage):

| Browser                          | Support                                       |
| -------------------------------- | --------------------------------------------- |
| Chrome / Edge desktop            | ✅ 105+                                       |
| Opera desktop                    | ✅ 91+                                        |
| Firefox                          | ❌ not implemented (Mozilla opposes the spec) |
| Safari desktop & iOS             | ❌                                            |
| Chrome Android, Samsung Internet | ❌                                            |

**Requirements, both satisfied here:** a secure context (kick.com is HTTPS) and
transient user activation (the call happens in a click handler, which is a real
user gesture).

**⚠️ The one thing I could not verify.** Whether `showSaveFilePicker` is
reachable from inside the userscript sandbox. With `@grant` set, Tampermonkey
and Violentmonkey run the script against a proxied `window`, and I could not
find documentation confirming this particular method is forwarded. I have no way
to test it from here — it needs a real browser with the extension installed.

Before writing any downloader code, run this in the console **from a userscript**
on kick.com:

```js
console.log(
  typeof window.showSaveFilePicker,
  typeof unsafeWindow?.showSaveFilePicker,
);
```

Two `"function"` results means Stage A is clear. If only `unsafeWindow` has it,
the fix is one line and `@grant unsafeWindow` gets added. If neither has it,
Stage A is dead in that manager and the whole plan needs revisiting. I would not
start building until this is answered.

**Fallback where FSA is missing.** There isn't one worth shipping. The
alternatives — an in-memory `Blob` or a `StreamSaver`-style service worker
shim — either cannot survive the file sizes in §1 or depend on a third-party
origin, which is exactly what this feature is meant to remove. Recommendation:
**feature-detect, and where FSA is absent show the `kick-video.download` entry
alone.** That is the escape hatch the brief asks for anyway.

## 3. Fetching segments

**Use plain `fetch()`.** Measured on both the media playlist and the segments:

```
Content-Type: application/x-mpegURL      (playlist)
Content-Type: video/MP2T                 (segments)
access-control-allow-origin: *
access-control-allow-methods: GET
```

`stream.kick.com` is fully CORS-open, so `GM_xmlhttpRequest` is unnecessary.
`fetch()` is also strictly better here: `response.body` is a `ReadableStream`
that can be piped straight into the FSA writable, whereas
`GM_xmlhttpRequest` with `responseType: "arraybuffer"` materialises each whole
segment (~10 MB) in memory before handing it over, and cannot stream.

Range requests work (`206 Partial Content`), which gives a clean basis for
resuming an interrupted segment.

One observation worth recording: `kick.com`'s API sits behind Cloudflare and
fingerprints clients — Node's `fetch` got `403` where curl with a browser
User-Agent got `200`. This does **not** affect the userscript, which runs in a
real browser with real cookies, and `stream.kick.com` served every request
without complaint. It only matters if you ever script this outside a browser.

## 4. Container format

**MPEG-TS, confirmed two ways:** `Content-Type: video/MP2T`, and the payload has
`0x47` sync bytes at every 188-byte boundary (checked at offsets 0, 188, 376,
564, 752, 940).

So byte-concatenating the segments produces a valid `.ts` file with no
remuxing — which VLC and mpv play directly. Given the stated workflow ("I feed
these into mpv anyway"), that covers the actual requirement.

**The expected blocker is absent.** kick.com sends **no `Content-Security-Policy`
header at all**, and there is no `<meta http-equiv>` CSP in the document. I
verified this against the complete response header list, not a single grep:

```
Age CF-RAY Cache-Control Connection Content-Type Date Nel Report-To Server
Transfer-Encoding alt-svc cf-cache-status last-modified link set-cookie vary
x-middleware-rewrite x-nextjs-postponed x-nextjs-stale-time
```

No CSP means WASM, blob workers and object URLs are all unrestricted. The thing
the brief expected to kill the feature does not apply.

### `ffmpeg.wasm` — not viable

Ruled out on size, not CSP:

- Its virtual filesystem tops out around **2 GB**; wasm32's address space caps
  at 4 GB. A 3-hour 1080p VOD is 11.3 GB. It cannot hold the input, let alone
  the output.
- The multithreaded build needs `SharedArrayBuffer`, which requires
  `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers.
  kick.com sends neither, so only the single-threaded build could ever run.
- ~30 MB payload on top of that.

### `mux.js` — viable, if `.mp4` is ever wanted

- Pure JavaScript, no WASM, so no CSP or COOP/COEP question at all.
- Purpose-built as an MPEG2-TS → fMP4 transmuxer with an incremental,
  event-driven API: push `Uint8Array` chunks in, get fMP4 out. Memory stays
  bounded, so VOD length is irrelevant.
- Handles AAC audio in the TS stream, including `mp4a.40.2` — exactly the codec
  Kick uses.

It would slot in as a transform between the fetch and the disk writer without
changing Stage A's shape.

## 5. Audio

**Muxed into the video variants. No separate rendition.** From the master
playlist, every variant declares both codecs:

```
#EXT-X-STREAM-INF:...,CODECS="avc1.64002A,mp4a.40.2",RESOLUTION=1920x1080,...
```

and the only `EXT-X-MEDIA` entries are `TYPE=VIDEO` — there is no
`TYPE=AUDIO` group anywhere in the manifest.

A concat-only download therefore produces video **with** sound. The design
concern raised in the brief does not materialise.

Variants available:

| Rendition | Resolution | Bandwidth | FPS |
| --------- | ---------- | --------- | --- |
| 1080p60   | 1920×1080  | 9,014,863 | 60  |
| 720p60    | 1280×720   | 3,483,983 | 60  |
| 480p30    | 852×480    | 1,488,983 | 30  |
| 360p30    | 640×360    | 630,000   | 30  |
| 160p30    | 284×160    | 230,000   | 30  |

The quality menu already parses this list, so the dialog's quality picker needs
no new fetching.

## 6. Rate limiting

No throttling found. Each level fetched a 1 MB range from distinct segments:

| Concurrency | Result        | Non-2xx |
| ----------- | ------------- | ------- |
| 4           | 4/4 × `206`   | 0       |
| 8           | 8/8 × `206`   | 0       |
| 16          | 16/16 × `206` | 0       |
| 24          | 24/24 × `206` | 0       |

No `429`, no connection resets, no `Retry-After`. Throughput rose to roughly
15 MB/s around 16 parallel connections and stopped improving past that — the
plateau looks like local bandwidth, not a server-side cap.

**Recommended:** **6–8 concurrent** segment fetches. That sits near the
throughput knee while staying well clear of anything that looks abusive, and
browsers cap per-host HTTP/1.1 connections at 6 anyway. Retry on network error
or 5xx with exponential backoff (1s, 2s, 4s, cap 3 attempts), and treat a `429`
— should one ever appear — by honouring `Retry-After` and halving concurrency.

Even at a perfect 15 MB/s, 11.3 GB takes about **13 minutes**; realistically
longer. Cancel has to work mid-download, and the progress indicator should show
bytes and ETA, not just a segment count.

---

## Recommendation

**Build Stage A.** The evidence supports it:

- Audio is muxed, so `.ts` concatenation yields a complete, playable file (§5).
- Segments are CORS-open, so `fetch()` streams them with no GM shim (§3).
- No CSP stands in the way (§4).
- No rate limiting to design around (§6).
- It matches the stated workflow — these go into mpv.

**Conditional on the §2 sandbox check passing.** That is the only genuine
unknown, it is five minutes of work, and everything else depends on it.

**Do not build Stage B yet.** `mux.js` makes `.mp4` technically viable and
`ffmpeg.wasm` does not, but `.ts` already satisfies the use case. Adding a
dependency and a remux stage for browser playability is worth doing only if you
actually want that — it is not needed for mpv or VLC.

**Scope notes for Stage A:**

- Default the quality picker to **720p60**, not 1080p60. It is 4.4 GB for three
  hours against 11.3 GB, and for a VOD it is usually the better trade.
- Show the projected size next to each quality before the download starts. The
  numbers in §1 make that a straightforward calculation from `BANDWIDTH` ×
  duration.
- Keep `kick-video.download` in the dialog as the escape hatch, and make it the
  only option where FSA is unavailable.
- Segment URLs are simple sequential names (`0.ts` … `5314.ts`) resolved
  relative to the media playlist directory, so enumeration needs no parsing
  beyond reading `#EXTINF` lines.

---

## Outcome — Stage A built, 2026-09-18

The sandbox question in §2 was answered with a throwaway probe on
Violentmonkey 2.49.0:

| Browser | `window.showSaveFilePicker` | `unsafeWindow.` | End-to-end write         |
| ------- | --------------------------- | --------------- | ------------------------ |
| Chrome  | `function`                  | `function`      | PASS — real file created |
| Firefox | `undefined`                 | `undefined`     | no picker                |

So the sandboxed `window` works and no `@grant unsafeWindow` was needed for
Chrome, though the grant is declared anyway because the fallback arm
references the identifier. Firefox matches the caniuse data exactly and takes
the feature-detected path: quality list disabled, `kick-video.download` only.

**Stage A shipped. Stage B was not built**, as recommended — `.ts` already
plays in mpv, and `mux.js` would be a dependency added purely for browser
playability.

### One correction to §2

An earlier draft of the implementation plan claimed `showSaveFilePicker` must
be called synchronously because any `await` consumes user activation. The
probe disproved it: a 50 ms `await` and the picker still opened. The real rule
is a **time budget** — Chrome's transient activation lasts about five seconds
and the picker consumes it.

The two-click dialog flow survived that correction for a better reason: a cold
`findStreamUrlFromMetadata` probes up to 33 URLs sequentially with 3 s
timeouts, which can exceed the budget by an order of magnitude. A one-click
design would have worked on a warm cache and failed on a cold one — failing
intermittently rather than consistently, which is worse.

### What the numbers turned into

- `DOWNLOAD_CONCURRENCY = 8`, `DOWNLOAD_WINDOW = 16` — from the "no throttling
  to 24, plateau near 16" measurement in §6.
- The window is anchored to the **write** cursor, which is what bounds memory
  to ~16 × 10.5 MB ≈ 180 MB regardless of VOD length. Anchoring it to the
  completed-buffer size instead would have let one slow segment buffer the
  whole 11.3 GB — the exact failure §1 says streaming to disk exists to avoid.
- `credentials: "omit"` is mandatory, not hygiene: the
  `Access-Control-Allow-Origin: *` measured in §3 is invalid for credentialed
  requests.
- The quality picker defaults to 720p60 and shows projected sizes from §1,
  because there is no way to check free space for a picker-chosen location.
