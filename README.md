# Kick Extended

A userscript that replaces Kick's VOD player with a custom hls.js-based one and
adds a handful of things around it.

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
2. Open **[the latest release][install]** and the manager will offer to install
   it.

[install]: https://github.com/wisnuwirayuda15/kick-extended/releases/latest/download/KickExtended.user.js

That link always points at the newest release, so it is safe to bookmark or
share.

### Updates

Installs update themselves. The script carries `@updateURL` and `@downloadURL`
pointing at the latest release, so the manager checks periodically — on its own
schedule, typically daily — and re-installs when a newer `@version` appears. The
check downloads a ~1 KB header-only file rather than the whole script.

To update immediately, use your manager's "Check for userscript updates"
command, or just reinstall from the link above.

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
so it can be read straight from the repo. CI fails if it is stale, so rebuild
and commit it alongside any change to `src/`.

| Script           | Does                                  |
| ---------------- | ------------------------------------- |
| `bun run dev`    | Vite dev server                       |
| `bun run build`  | Type-check, then build the userscript |
| `bun run check`  | `node --check` on the built output    |
| `bun run lint`   | ESLint over `src`                     |
| `bun run format` | Prettier over the repo                |

## Releasing

Every push and pull request runs lint, type-check and build, and asserts the
userscript header still carries its four `@grant`s, three `@connect`s, both
`@match`es, the hls.js `@require` and the two update URLs.

Pushing a `v*` tag also publishes a release:

```bash
git tag v2.0.1
git push origin v2.0.1
```

CI takes `@version` from the tag, so it cannot ship stale — and since managers
only re-install when `@version` increases, **the tag is what actually delivers
an update**. Bump it for anything you want existing installs to receive.

The release gets both `KickExtended.user.js` and the header-only
`KickExtended.meta.js`, which is what `@updateURL` points at.

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
licensed under Apache-2.0. This is a modified script for userscript version, split into modules and rebuilt with `vite-plugin-monkey`.

Licensed under [Apache-2.0](LICENSE).
