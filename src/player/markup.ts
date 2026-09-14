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
 * The custom player. Every id and class here is load-bearing: the CSS in
 * styles.css and the query block in controls.ts both depend on them, so
 * the k- prefix and these exact names must not change.
 */
export function buildPlayerMarkup() {
  return `
            <div id="k-player" style="width:100%;height:100%;position:relative;background:black;overflow:hidden;font-family:Inter,sans-serif;">
                <video id="k-video" playsinline style="width:100%;height:100%;object-fit:contain;"></video>
                <div id="k-loading" class="visible" aria-hidden="true">
                    <div class="k-loading-spinner"></div>
                </div>
                <div id="k-controls" style="position:absolute;bottom:0;left:0;width:100%;padding:20px 15px 10px 15px;background:linear-gradient(to top, rgba(0,0,0,0.9), transparent);display:flex;flex-direction:column;opacity:0;transition:opacity 0.2s;">
                    <div id="k-track" style="width:100%;height:5px;padding:8px 0;background:rgba(255,255,255,0.3);background-clip:content-box;box-sizing:content-box;cursor:pointer;position:relative;margin-bottom:4px;border-radius:2px;">
                        <div id="k-track-tooltip">
                            <div id="k-track-tooltip-time">0:00</div>
                        </div>
                         <div id="k-progress" style="width:0%;height:100%;background:#53fc18;position:relative;border-radius:2px;"></div>
                    </div>
                    <div id="k-controls-row">
                        <div id="k-controls-left">
                            <button id="k-play" style="background:none;border:none;cursor:pointer;opacity:0.9;">${ICONS.play}</button>
                            <span id="k-time" style="font-size:13px;color:#ddd;font-variant-numeric:tabular-nums;">0:00 / 0:00</span>
                            <div id="k-volume-wrap">
                                <button id="k-volume-btn" type="button" aria-label="Mute volume">${ICONS.volumeHigh}</button>
                                <input id="k-volume" type="range" min="0" max="1" step="0.01" value="1">
                                <span id="k-volume-value">100%</span>
                            </div>
                        </div>
                        <div id="k-controls-right">
                            <button id="k-native-btn" type="button" title="Kembali ke player Kick">${ICONS.swap}</button>
                            <div id="k-ext-wrap" class="k-ext-wrap">
                                <button id="k-ext-btn" type="button" title="Open in external player" aria-label="Open in external player">${ICONS.external}</button>
                                <div id="k-ext-menu" class="k-ext-menu"></div>
                            </div>
                            <div id="k-quality-wrap">
                                <button id="k-quality-btn" type="button">Auto ▴</button>
                                <div id="k-quality-menu"></div>
                            </div>
                            <button id="k-fs" style="background:none;border:none;cursor:pointer;opacity:0.9;">${ICONS.maximize}</button>
                        </div>
                    </div>
                </div>
                <div id="k-seek-indicator" aria-hidden="true"></div>
                <button id="k-seek-back" class="k-center-seek" type="button" title="Mundur 10 detik" aria-label="Mundur 10 detik">
                    ${ICONS.backward}<span class="k-center-seek-label">10</span>
                </button>
                <button id="k-big-play" style="position:absolute;top:50%;left:50%;width:70px;height:70px;background:rgba(7,7,7,0.72);border-radius:50%;border:1px solid rgba(255,255,255,0.18);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                    ${ICONS.bigPlay}
                </button>
                <button id="k-seek-fwd" class="k-center-seek" type="button" title="Maju 10 detik" aria-label="Maju 10 detik">
                    ${ICONS.forward}<span class="k-center-seek-label">10</span>
                </button>
            </div>
        `;
}
