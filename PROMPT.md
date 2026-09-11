# Prompt: build the "Kick Extended" userscript project

> Paste this whole file as your first message in Claude Code.
> Drop `KickNoSub.user.js` and `KickVideoDownloader.user.js` into the project folder first.

---

## Context

I have a Vite project already set up in this folder. It's fresh, so verify what's actually there before assuming anything, and add whatever is missing rather than scaffolding from scratch.

Alongside it are two standalone userscripts I want merged into that project.

### Source 1: `KickNoSub.user.js` (~2000 lines)

Runs on kick.com, replaces Kick's native player with a custom hls.js-based one.

1. **Sub-only VOD unlock.** Detects the `[data-testid="video-subscriber-only"]` overlay, pulls video metadata from Kick's API, builds a `master.m3u8` URL, replaces the overlay with the custom player.
2. **Custom player.** Scrubbable progress bar, quality menu, volume control, resume position, per-video persisted playback settings.
3. **Keyboard shortcuts.** Arrow keys, `j`/`k`/`l`, `f`, `m`, `0`-`9`, `,`/`.`, Home/End.
4. **Auto-hiding controls** on an inactivity timer, with separate touch behaviour (tap reveals the overlay, double tap enters fullscreen).
5. **External player handoff.** Dropdown to copy the stream URL, download an `.m3u` playlist, or launch VLC / PotPlayer / IINA / mpv via protocol handlers.
6. **Player switching on normal VOD pages.** A button in the native control bar swaps to the custom player, with the choice persisted so later visits swap automatically.
7. **Copy stream URL button** in the channel header, next to the verified badge.
8. **Chat replay** synced to video position.
9. **Update checker** hitting the GitHub Releases API.

### Source 2: `KickVideoDownloader.user.js` (~180 lines)

A separate script I wrote. Two features:

1. A **Download** button on VOD pages, inserted after the Subscribe button, cloning that button's classes so it blends into Kick's UI.
2. A small download button in the **top-right corner of every video thumbnail**, revealed on hover.

Both open `https://kick-video.download/?download={url}` in a new tab. That's a third-party service, not mine.

This script becomes part of Kick Extended rather than staying separate.

---

## Goals

1. **Rebrand** from "KickNoSub" to **"Kick Extended"**. The old name describes one of ten features.
2. **Merge** both scripts into a single userscript.
3. **Split** the monolith into modules that are pleasant to work on.
4. **Build** with `vite-plugin-monkey`, emitting one installable `.user.js`.

This is a **refactor, not a rewrite.** Runtime behaviour stays identical. Do not add features, and do not "fix" logic that looks odd without asking first. Several things that look redundant are deliberate, and the reasons are in the "Landmines" section below.

The one exception is the optional Phase 7 at the very end, which is new work and explicitly gated.

---

## Phase 1: read first, write nothing

Before writing any code:

1. Inspect the existing Vite project. Report the Vite version, what's in `package.json`, whether `vite-plugin-monkey` is already installed, and whether the setup is TypeScript or JavaScript.
2. Read **both** userscripts end to end.
3. Summarise the module structure you'd extract: which functions exist, what depends on what, and which pieces are global state (`activeHls`, `activePlayerUi`, `activeChatController`, `isUnlocking`, `autoSwitchTimer`, `nativeExternalCache`, `globalPlayerListenersBound`).

**Stop there and wait for my confirmation before Phase 2.**

---

## Phase 2: project structure

Target layout:

```
src/
  meta.ts             # userscript header definition for vite-plugin-monkey
  main.ts             # bootstrap, MutationObserver, destroyCustomPlayer
  constants.ts        # EVERY Kick DOM selector + localStorage keys
  styles.css          # the entire current GM_addStyle blob
  icons.ts            # the ICONS object
  lib/
    gm-fetch.ts       # gmFetch, checkStreamUrl
    storage.ts        # resume/settings keys, load/savePlayerSettings, version compare
    kick-api.ts       # getVideoMetadata, findStreamUrlFromMetadata, resolveStream
    update-check.ts   # getLatestReleaseInfo and friends
  chat/
    chat-controller.ts
  player/
    markup.ts         # player HTML template
    mount.ts          # unlockVideo, orchestration
    controls.ts       # visibility, auto-hide, scrubbing, center seek
    shortcuts.ts      # global keydown map
    external.ts       # buildExternalTargets, populateExternalMenu, launchScheme
    quality.ts        # quality menu
  native/
    detect.ts         # isVodPage, getNativeVideo, isNativePlayerReady, findNativePlayerContainer
    switch-button.ts  # ensureCustomPlayerToggle, injectNativeExternalButton
    copy-url-button.ts
    teardown.ts       # stopNativePlayback
  download/
    download-button.ts    # Download button next to Subscribe
    thumbnail-buttons.ts  # per-thumbnail download button
    download-url.ts       # buildDownloadUrl
```

Plus `vite.config.ts`, `tsconfig.json`, `.prettierrc`, `eslint.config.js`, `README.md`, `LICENSE`, `.gitignore`.

If you think a different split makes more sense, propose it rather than just doing it.

**TypeScript, but loose.** Start with `strict: false`. The point is autocomplete and catching typos in selector names, not type gymnastics. Don't build elaborate types for Kick's API responses, which aren't stable anyway; `any` at the API boundary is fine.

---

## Phase 3: userscript header

The current KickNoSub header:

```
// @name         KickNoSub
// @namespace    https://github.com/Enmn/KickNoSub
// @version      1.1.2
// @description  Unlock subscriber-only videos on Kick by replacing the overlay with an HLS player.
// @author       Enmn
// @match        *://kick.com/*
// @match        *://www.kick.com/*
// @icon         https://kick.com/favicon.ico
// @require      https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_info
// @connect      kick.com
// @connect      web.kick.com
// @connect      stream.kick.com
// @connect      api.github.com
// @run-at       document-idle
```

Changes:

- `@name` becomes `Kick Extended`.
- `@description` should cover the whole feature set, not just unlocking. Propose a few options.
- `@namespace` and `@author`: **ask me first.** The original repo is `Enmn/KickNoSub` and I need to settle attribution before these change. Don't guess.
- `@version` resets to `2.0.0`, since the name and structure change completely.

What must **not** change:

- Every `@match`, `@connect`, `@run-at`.
- The hls.js `@require`. Wire it through vite-plugin-monkey's `externalGlobals` so hls.js keeps coming from the CDN instead of being bundled. The global the code uses is `Hls`.
- All four `@grant`. vite-plugin-monkey can collect grants from usage automatically; if you use that, verify all four survive. `GM_setClipboard` is easy to miss since it appears in only two places.

---

## Phase 4: migrate the code

Move code into the modules from Phase 2. Rules:

- **One commit per module**, with a clear message. No single giant commit.
- After each module moves, run the build and confirm the output still passes `node --check`.
- Don't rename functions unless a name is genuinely misleading. If you do rename, say so in the commit message.
- **Don't change DOM IDs or classes** (`k-player`, `k-video`, `k-controls`, `k-ext-wrap`, and so on). Keep the `k-` prefix. Changing it means touching hundreds of lines of CSS for no benefit.
- The explanatory comments already in the code record *why* something is written a certain way. Preserve them as you move code.

### CSS

The entire `GM_addStyle(...)` template literal moves to `src/styles.css`. This is the main reason I want a build step, so be careful here.

Must survive untouched:

- The `@container (max-width: 560px)` and `@container (max-width: 380px)` blocks, plus `container-type: inline-size` on `#k-player`. Make sure the build target doesn't downlevel or strip these.
- The `-webkit-backdrop-filter` prefixes. Don't let autoprefixer drop them.
- The `#k-progress::after` pseudo-element and every `::-webkit-slider-*` / `::-moz-range-*` selector for the volume slider.

CSS must still reach the page via `GM_addStyle`, not a `<style>` tag injected by Vite, so behaviour matches today.

### localStorage keys

Three keys currently use the old prefix:

```
kick_unlocker_resume:{channel}:{video}
kick_unlocker_settings:{channel}:{video}
kick_unlocker_prefer_custom
```

Renaming outright would wipe every resume position and setting already in my browser. Write using a new `kick_extended_` prefix, but on read, fall back to the old key and migrate the value across. Keep this logic in `src/lib/storage.ts` only.

---

## Phase 5: merging the two scripts

They were written independently and duplicate several things. Resolve these rather than stacking them.

1. **Two `MutationObserver`s on `document.body` with `subtree: true`.** Collapse into one observer in `main.ts` that calls every injector. This is the biggest performance cost if left doubled.

2. **Two `history.pushState`/`replaceState` patches.** Kick Extended uses its patch for `handleLocationChange()`; the downloader uses its own for `setTimeout(runInjections, 100)`. Patching the same global method twice is fragile and makes load order matter. Make it one patch with one callback list.

3. **Two different VOD route definitions.** The downloader uses `VIDEO_PAGE_REGEX = /^\/[^/]+\/videos\/[^/]+\/?$/`, while Kick Extended's `isVodPage()` also accepts the singular `/video/` form and doesn't anchor the end. Settle on one canonical definition in `constants.ts`. **Ask me first** which is correct; I'm not sure whether Kick still uses the singular form.

4. **Different DOM prefixes:** the downloader uses `km-`, Kick Extended uses `k-`. Standardise on `k-`, so `k-download-btn` and `k-thumb-dl-btn`.

5. **The downloader injects CSS via a `<style>` tag,** Kick Extended via `GM_addStyle`. Move the downloader's CSS into the same `src/styles.css`.

6. **`@grant none` vs four grants.** Once merged, the downloader code runs in the userscript sandbox rather than the page context directly. It only uses DOM APIs and `window.open`, so it should be fine, but verify `window.open` still works.

7. **The downloader's `@match` is narrower** (`https://kick.com/*` only, no `www`, no `http`). Use Kick Extended's broader set.

8. **Icon.** The downloader has its own base64 SVG `@icon`; Kick Extended uses Kick's favicon. Ask me which to keep.

### Notes on the downloader code

Three things I already suspect are problems. **Report your analysis, don't change them.**

- `findSubscribeButton()` runs `document.querySelectorAll("button span")` and iterates all of it. It's called from the observer, meaning it runs on every DOM change. On a page with active chat, that's constant.
- The `isVideosListPage()` guard in `injectThumbnailButtons()` is commented out on purpose so thumbnail buttons appear everywhere, not just on the video list page. I don't remember whether that was a final decision or leftover experimentation. Give me your opinion.
- Subscribe button detection relies on `textContent === "Subscribe"`, which breaks if Kick's UI isn't in English. Find out whether there's a stabler `data-testid` for that button.

---

## Landmines

These came out of several rounds of debugging. Don't regress them.

1. **The `==UserScript==` block is configuration, not a comment.** Minifiers and bundlers will delete it. vite-plugin-monkey handles this, but verify the built output really has it at the top.

2. **Kick's PiP button only mounts on hover.** Never use it as a readiness signal. The correct marker is the `<video id="video-player">` element. The anchor for inserting buttons is `[data-testid="video-player-clip"]`.

3. **A `<video>` detached from the DOM keeps playing audio.** That's why `destroyCustomPlayer()` calls `pause()`, `removeAttribute("src")`, `load()` and `remove()`. It's triggered from the `history.pushState`/`replaceState` patch, `popstate`, `hashchange`, `pagehide`, and an `isConnected` check inside the MutationObserver. All five paths must survive.

4. **`ChatController.fetchLoop` terminates via `this.activeSessionId++`,** not a boolean flag. The `stop()` method relies on that.

5. **Mobile browsers fire synthetic mouse events after a tap.** That's why the controls state is captured at `pointerdown` (`controlsShownAtGestureStart`) rather than read during `click`. Reverse it and taps will always close the overlay and never open it.

6. **Auto-switching to the custom player waits for the native player to be ready.** The gate: element exists, `getBoundingClientRect()` reports sane dimensions, `readyState >= 1` or `currentSrc` is set, then a 700ms settle delay and a re-check.

7. **The stream is resolved before the container is destroyed** when `manualSwitch === true`. On failure the native player is left intact and the auto-switch preference is cleared. That order matters; reversing it leaves the page dead with no way back.

8. **Scrubbing uses `setPointerCapture`,** and `vid.currentTime` is only set on pointer release. Setting it during the drag makes hls.js load segments continuously.

9. **Kick's Tailwind-based selectors (`.relative.flex.flex-col`) are fragile.** There's already a fallback that climbs from the `<video>` while ancestor dimensions stay close to the video's. Collect every Kick selector into `src/constants.ts` so a Kick redeploy means opening one file.

---

## Phase 6: tooling and docs

- **Prettier + ESLint.** Minimal config, not a preset that argues with me. Run once across the source.
- **npm scripts:** `dev`, `build`, `lint`, `format`.
- **Commit `dist/KickExtended.user.js`** so people can install from the raw URL without building.
- **README.md** covering: feature list, install instructions, a keyboard shortcut table, how to build from source, and a note that external player protocol handlers need per-OS registration.
- **LICENSE:** ask me, tied to the attribution question in Phase 3.
- **.gitignore** for `node_modules`, `.vite`, and friends.

No GitHub Actions yet. Later, once the structure settles.

---

## How to verify

After building, check these yourself and report results:

1. `node --check dist/KickExtended.user.js` passes.
2. The `==UserScript==` block is at the top, with all four `@grant`, all four `@connect`, the hls.js `@require`, and both `@match` entries.
3. `hls.min.js` appears in `@require`, and hls.js itself is **not** bundled into the output. Check the file size; far above 90 KB means it got bundled.
4. These selectors are all still present: `video-subscriber-only`, `video-player-clip`, `VerifiedBadge`, `channel-username`, `#video-player`.
5. `kick-video.download` appears exactly **once** (the two old scripts each had their own call site; merged, it goes through one helper).
6. The CSS in the output still contains `@container`, `container-type: inline-size`, and `-webkit-backdrop-filter`.
7. Count `addEventListener` in the new source. KickNoSub has **57**, the downloader has **3**, so **60** total. A lower final number is fine if it comes from collapsing the duplicated observer and history patch, but explain the difference line by line.
8. Exactly **one** `new MutationObserver` and **one** block patching `history.pushState` across the whole source.

I'll test manually on kick.com once all of that is green.

---

## Working rules

- When torn between two approaches, ask. Don't quietly pick one.
- If you find a bug in the old code, **report it, don't fix it.** I want to know what changed because of the migration versus what changed because of a fix.
- Never add yourself as a co-author on commit messages.
- No dependencies beyond what Vite, vite-plugin-monkey, TypeScript, ESLint and Prettier need. Phase 7 may add one or two; ask before installing.
- The downloader code was written long after KickNoSub and reads differently. Align its style with the rest as you move it, but leave the logic alone.

---
---

# Phase 7 (optional, do this last)

**Do not start this until Phases 1 through 6 are done, reviewed by me, and committed.** This is new feature work, not migration, and I want a clean boundary between the two.

## Goal

Replace the third-party `kick-video.download` handoff with a downloader built into the script. We already resolve `master.m3u8` and already parse the variant list for the quality menu, so the raw material is there.

The download button should open a small dialog with:

- **Quality**: the variant list from the master playlist, with resolution and bitrate.
- **Format**: see the staging below.
- A **progress indicator** with a working cancel.

## Feasibility: read this before designing anything

I'd rather you tell me this is a bad idea than build something that falls over on a real VOD. My VODs run past three hours.

Investigate and report on each of these **before writing code**:

1. **Size.** A three-hour 1080p VOD is several GB. Accumulating segments into an in-memory `Blob` will not survive that. What's the realistic ceiling?

2. **Streaming to disk.** The File System Access API (`showSaveFilePicker` plus a `WritableStream`) lets you write segments as they arrive instead of buffering everything. Confirm: does it work from inside a userscript sandbox, and which browsers support it? What's the fallback where it isn't available, and is that fallback worth shipping or should the feature just be disabled there?

3. **Fetching segments.** `GM_xmlhttpRequest` with `responseType: "arraybuffer"` sidesteps CORS, and `stream.kick.com` is already in `@connect`. Check whether plain `fetch()` works against the segment URLs; if it does, prefer it, since it streams and is far lighter. Report which one actually works.

4. **Container format.** Kick's HLS segments are most likely MPEG-TS. Concatenating `.ts` segments produces a valid `.ts` file with no remuxing, which VLC and mpv play fine but browsers mostly don't. Getting `.mp4` requires remuxing. Evaluate:
   - `mux.js` (small, TS to fMP4, already used by video players)
   - `ffmpeg.wasm` (does everything, but a ~30 MB payload and heavy memory use)
   - Confirm whether either can run inside a userscript given CSP on kick.com. **This is the part most likely to kill the feature.**

5. **Audio.** Find out whether Kick's variant streams carry muxed audio or reference a separate audio rendition in the master playlist. If it's separate, a concat-only approach yields a silent video and the whole design changes.

6. **Rate limiting.** Downloading a few thousand segments quickly may get throttled or blocked. What concurrency is sensible, and what's the retry strategy?

## Suggested staging

Only if the investigation comes back positive:

- **Stage A: `.ts` download, no dependencies.** Pick a quality, fetch the media playlist, stream segments to disk through the File System Access API, concatenate. Progress and cancel included. This alone covers most of what I want, since I feed these into mpv anyway.
- **Stage B: `.mp4`, optional.** Remux on top of Stage A, only if step 4 says it's viable. The format picker gets a second entry. If `ffmpeg.wasm` is the only path, say so plainly and I'll decide whether the payload is worth it.

Don't build Stage B speculatively.

## Keep the escape hatch

Whatever happens, keep the existing `kick-video.download` handoff as a fallback entry in the dialog. If the built-in downloader fails on some VOD, I want something that still works.

## Report first

Write your findings on all six points to `docs/download-feature-research.md`, include a recommendation on whether to proceed, and **wait for my go-ahead** before implementing anything.