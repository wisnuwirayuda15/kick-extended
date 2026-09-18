// Every selector that reaches into Kick's own DOM lives here.
//
// Kick's markup is React + Tailwind and churns without warning, so when a Kick
// redeploy breaks the script the fix should mean opening one file rather than
// grepping the whole source. Selectors the script owns (the k- prefixed ids and
// classes it creates itself) deliberately stay inline where they are used.

/** Overlay Kick renders in place of the player on subscriber-only VODs. */
export const SUBSCRIBER_ONLY_SELECTOR = '[data-testid="video-subscriber-only"]';

/** Anchor for injecting buttons into Kick's native control bar. */
export const CONTROL_ANCHOR_SELECTOR = '[data-testid="video-player-clip"]';

/** Verified badge next to the channel name; anchor for the copy-URL button. */
export const BADGE_SELECTOR = 'svg[data-ds-icon="VerifiedBadge"]';

/** Fallback anchor for the copy-URL button when there is no verified badge. */
export const CHANNEL_NAME_SELECTOR = "h1#channel-username";

/** Kick's own <video>. The id is the only reliable readiness marker. */
export const NATIVE_VIDEO_SELECTOR = "#video-player";

/** Any <video> that is not ours, for when Kick drops the id. */
export const NATIVE_VIDEO_FALLBACK_SELECTOR = "video:not(#k-video)";

/**
 * Tailwind-shaped wrapper around the player. Fragile by nature, which is why
 * findNativePlayerContainer falls back to climbing up from the <video>.
 */
export const PLAYER_CONTAINER_SELECTOR = ".relative.flex.flex-col";

/** The longer variant Kick uses around the subscriber-only overlay. */
export const SUBSCRIBER_OVERLAY_CONTAINER_SELECTOR =
  ".relative.flex.flex-col.items-center.justify-center.overflow-hidden.rounded";

/** Kick's chat pane, reused to host chat replay. */
export const KICK_CHAT_SELECTOR = "#chatroom-messages";

/**
 * localStorage prefixes. Writes use STORAGE_PREFIX; reads fall back to
 * LEGACY_STORAGE_PREFIX and migrate the value across, so the rebrand does not
 * wipe resume positions and settings that are already in the browser.
 */
export const STORAGE_PREFIX = "kick_extended_";
export const LEGACY_STORAGE_PREFIX = "kick_unlocker_";

/** Remembers that the user prefers the custom player on normal VOD pages. */
export const AUTO_CUSTOM_KEY = `${STORAGE_PREFIX}prefer_custom`;

/**
 * Kick mounts the <video> long before it is usable, so auto-switching waits
 * for the readiness gate, then settles for this long and re-checks.
 */
export const AUTO_SWITCH_SETTLE_MS = 700;

/**
 * The canonical VOD route. The two merged scripts disagreed: the downloader
 * used an anchored /videos/ regex, while isVodPage also accepted the singular
 * /video/ form and did not anchor the end. This accepts both spellings and
 * anchors, so /chan/videos/123/extra no longer matches.
 */
export const VOD_PATH_REGEX = /^\/[^/]+\/videos?\/[^/]+\/?$/;

/** A channel's video list page. */
export const VIDEOS_LIST_PATH_REGEX = /^\/[^/]+\/videos\/?$/;

/** Download button injected next to Kick's Subscribe button. */
export const DOWNLOAD_BUTTON_ID = "k-download-btn";

/** Per-thumbnail download button, revealed on hover. */
export const THUMB_DOWNLOAD_BUTTON_CLASS = "k-thumb-dl-btn";

/** Marks a thumbnail anchor as already carrying a download button. */
export const THUMB_INJECTED_FLAG = "kDlInjected";

/**
 * Downloader tuning.
 *
 * Measured against stream.kick.com: no throttling at 4/8/16/24 concurrent, and
 * throughput stops improving past ~16 parallel connections. 8 sits near the
 * knee while staying under the browser's 6-per-host HTTP/1.1 pool plus headroom.
 *
 * The window is what bounds memory. A worker may only claim a segment within
 * DOWNLOAD_WINDOW of the one still waiting to be written, so at most that many
 * ~10.5 MB segments are ever resident: roughly 180 MB, flat, whether the VOD is
 * 20 minutes or 15 hours. Widening it past 2x concurrency buys nothing and
 * costs memory linearly.
 */
export const DOWNLOAD_CONCURRENCY = 8;
export const DOWNLOAD_WINDOW = 16;

/** 3 attempts means two backoff sleeps: 1s then 2s. */
export const DOWNLOAD_MAX_ATTEMPTS = 3;

/**
 * Consecutive segment failures before giving up entirely. Isolated flakes are
 * survivable and get skipped; a wall of failures means the playlist is stale or
 * the VOD was trimmed, and every remaining fetch will fail the same way.
 */
export const DOWNLOAD_FAILURE_BREAKER = 5;

/** Progress emit rate. Decoupled from writes so the ETA still moves during a stall. */
export const DOWNLOAD_PROGRESS_INTERVAL_MS = 250;

/** Dialog and progress panel. */
export const DOWNLOAD_DIALOG_ID = "k-download-dialog";
export const DOWNLOAD_PANEL_ID = "k-download-panel";
