# Kick Extended

A userscript that replaces Kick's VOD player with a custom hls.js-based one and
adds a handful of things around it.

Version 2.0.0. Formerly **KickNoSub** — renamed because unlocking
subscriber-only VODs is one of ten features, not the whole script.

## Features

- **Sub-only VOD unlock.** Detects Kick's subscriber-only overlay, resolves the
  video's `master.m3u8` and mounts a working player in its place.
- **Custom player.** Scrubbable progress bar with a hover time tooltip, quality
  menu, volume slider, resume position and per-video playback settings.
- **Keyboard shortcuts.** See the table below.
- **Auto-hiding controls,** with separate touch behaviour: a tap reveals the
  overlay, a double tap enters fullscreen.
- **External player handoff.** Copy the stream URL, download an `.m3u`
  playlist, or launch VLC, PotPlayer, IINA or mpv.
- **Player switching on normal VODs.** A button in Kick's own control bar swaps
  to the custom player, and the choice is remembered for later visits.
- **Copy stream URL** button in the channel header.
- **Chat replay** synced to the video position.
- **Download buttons** on VOD pages and on every video thumbnail.
- **Update check** against the GitHub releases API.

## Install

1. Install a userscript manager — Tampermonkey, Violentmonkey or Greasemonkey.
2. Open [`dist/KickExtended.user.js`][raw] and the manager will offer to
   install it.

[raw]: https://github.com/wisnuwirayuda15/kick-extended/raw/main/dist/KickExtended.user.js

hls.js is loaded from jsDelivr at runtime via `@require`, so it is not bundled
into the script.

## Keyboard shortcuts

Active whenever the custom player is mounted. Ignored while typing in an input,
textarea, select or contenteditable, and when Ctrl/Cmd/Alt is held.

| Key           | Action                         |
| ------------- | ------------------------------ |
| `Space` / `K` | Play / pause                   |
| `→` / `←`     | Seek ±5 seconds                |
| `L` / `J`     | Seek ±10 seconds               |
| `↑` / `↓`     | Volume ±5%                     |
| `M`           | Mute, or restore to 50%        |
| `F`           | Fullscreen                     |
| `.` / `>`     | Playback rate +0.25 (max 4)    |
| `,` / `<`     | Playback rate −0.25 (min 0.25) |
| `0`–`9`       | Seek to 0%–90%                 |
| `Home`        | Seek to start                  |
| `End`         | Seek to end                    |

## External players

The external-player menu launches desktop players through protocol handlers
(`vlc://`, `potplayer://`, `iina://`, `mpv://`). **These are not registered by
default.** The OS only knows a scheme after the player — or you — registers it:

- **VLC** registers `vlc://` on install on most Linux desktops; on Windows and
  macOS it usually needs a manual registry or `Info.plist` entry.
- **PotPlayer** (Windows) registers `potplayer://` on install in recent builds.
- **IINA** (macOS) registers `iina://` on install.
- **mpv** has no scheme of its own; `mpv://` needs a helper such as
  `mpv-handler`.

If a menu entry does nothing, the scheme is not registered on your machine. The
**Copy stream URL** and **Download .m3u** entries work everywhere and need no
setup — paste the URL into any player that opens network streams.

## Build from source

Requires Node 20+ or Bun.

```bash
bun install
bun run build
```

The built script is written to `dist/KickExtended.user.js`, which is committed
so it can be installed from the raw URL without building.

| Script           | Does                                  |
| ---------------- | ------------------------------------- |
| `bun run dev`    | Vite dev server                       |
| `bun run build`  | Type-check, then build the userscript |
| `bun run check`  | `node --check` on the built output    |
| `bun run lint`   | ESLint over `src`                     |
| `bun run format` | Prettier over the repo                |

### Layout

`src/main.ts` is the bootstrap: it holds the single `MutationObserver` and the
single `history` patch that drive everything. From there:

- `lib/` — GM fetch wrapper, storage, Kick API, update check, formatting, toast
- `player/` — mount, controls, quality, shortcuts, markup, external handoff
- `native/` — detecting and driving Kick's own player and buttons
- `chat/` — chat replay
- `download/` — download buttons
- `constants.ts` — **every** Kick DOM selector, so a Kick redeploy means
  editing one file
- `styles.css` — the whole stylesheet, injected with `GM_addStyle`

## Credits and license

Based on [KickNoSub](https://github.com/Enmn/KickNoSub) by Enmn, which is
licensed under Apache-2.0. This is a modified fork: the two original scripts
(`KickNoSub.user.js` and a separate download-button script) have been merged,
split into modules and rebuilt with `vite-plugin-monkey`.

Licensed under [Apache-2.0](LICENSE).

The download buttons hand off to `kick-video.download`, a third-party service
that is not affiliated with this project.
