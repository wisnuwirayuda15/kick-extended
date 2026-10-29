import { ICONS } from "../icons.ts";

// Markup templates for the custom player. Kept as plain string builders so the
// ids and classes the CSS and control wiring depend on all live in one place.

/**
 * Placeholder shown the instant the container is wiped, before metadata
 * resolves. Sized to the fallback height so the page does not jump.
 */
export function buildSplashMarkup(fallbackMinHeight) {
  return `
            <div style="width:100%;height:100%;min-height:${fallbackMinHeight}px;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Inter,sans-serif;">
                <div style="font-size:18px;color:rgba(255,255,255,0.7);">Loading stream...</div>
            </div>
        `;
}

/**
 * Shown when no working master.m3u8 could be derived.
 */
export function buildStreamNotFoundMarkup() {
  return `
              <div style="width:100%;height:100%;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Inter,sans-serif;">
                  <div style="font-size:20px;color:rgba(255,255,255,0.7);font-weight:bold;">Stream Not Found</div>
              </div>`;
}

/**
 * Side-by-side video and chat panes, used when Kick's own chat pane is
 * not on the page to borrow.
 */
export function buildChatShellMarkup() {
  return `<div style="display:flex;width:100%;height:100%;"><div id="unlocker-video-area" style="flex:1;background:#000;position:relative;"></div><div id="unlocker-chat-area" style="width:320px;height:100%;border-left:1px solid #333;"></div></div>`;
}

/**
 * The custom player, laid out like Kick's own: a full-width seek bar over a
 * single row of 44px buttons. Every id and class here is load-bearing: the
 * CSS in styles.css and the query block in controls.ts both depend on them,
 * so the k- prefix and these exact names must not change.
 */
export function buildPlayerMarkup() {
  return `
            <div id="k-player">
                <video id="k-video" playsinline></video>
                <div id="k-loading" class="visible" aria-hidden="true">
                    <div class="k-loading-spinner"></div>
                </div>
                <div id="k-controls">
                    <div id="k-track">
                        <div id="k-track-tooltip">
                            <div id="k-track-tooltip-time">00:00</div>
                        </div>
                        <div id="k-track-bar">
                            <div id="k-buffered"></div>
                            <div id="k-progress"></div>
                        </div>
                    </div>
                    <div id="k-controls-row">
                        <div id="k-controls-left">
                            <button id="k-play" class="k-btn" type="button" aria-label="Play">${ICONS.play}</button>
                            <div id="k-volume-wrap">
                                <button id="k-volume-btn" class="k-btn" type="button" aria-label="Mute">${ICONS.volumeHigh}</button>
                                <input id="k-volume" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume">
                            </div>
                            <span id="k-time">00:00 / 00:00</span>
                        </div>
                        <div id="k-controls-right">
                            <div id="k-ext-wrap" class="k-ext-wrap k-menu-wrap">
                                <button id="k-ext-btn" class="k-btn" type="button" title="Open in external player" aria-label="Open in external player">${ICONS.external}</button>
                                <div id="k-ext-menu" class="k-ext-menu k-menu"></div>
                            </div>
                            <button id="k-fs" class="k-btn" type="button" title="Fullscreen" aria-label="Fullscreen">${ICONS.fullscreen}</button>
                            <div id="k-speed-wrap" class="k-menu-wrap">
                                <button id="k-speed-btn" class="k-btn" type="button" title="Playback speed" aria-label="Playback speed">${ICONS.speed}</button>
                                <div id="k-speed-menu" class="k-menu"></div>
                            </div>
                            <div id="k-quality-wrap" class="k-menu-wrap">
                                <button id="k-quality-btn" class="k-btn" type="button" title="Quality" aria-label="Quality">${ICONS.settings}</button>
                                <div id="k-quality-menu" class="k-menu"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="k-seek-indicator" aria-hidden="true"></div>
                <button id="k-seek-back" class="k-center-seek" type="button" title="Rewind 10 seconds" aria-label="Rewind 10 seconds">
                    ${ICONS.backward}<span class="k-center-seek-label">10</span>
                </button>
                <button id="k-big-play" type="button" aria-label="Play">
                    ${ICONS.bigPlay}
                </button>
                <button id="k-seek-fwd" class="k-center-seek" type="button" title="Forward 10 seconds" aria-label="Forward 10 seconds">
                    ${ICONS.forward}<span class="k-center-seek-label">10</span>
                </button>
            </div>
        `;
}

/** One row of a player menu, with the check Kick shows on the active one. */
export function buildMenuOption(label: string) {
  const option = document.createElement("button");
  option.type = "button";
  option.className = "k-menu-option";
  option.setAttribute("role", "menuitemradio");
  option.innerHTML = `<span></span>${ICONS.check}`;
  option.querySelector("span")!.textContent = label;
  return option;
}
