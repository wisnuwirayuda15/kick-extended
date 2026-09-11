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
