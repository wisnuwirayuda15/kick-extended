// ==UserScript==
// @name         Kick Extended
// @namespace    https://github.com/wisnuwirayuda15/kick-extended
// @version      4.6.0
// @author       Wisnu Wirayuda
// @description  Unlock subscriber-only VODs, a custom HLS player with keyboard shortcuts and quality control, chat replay, external player handoff, and video downloads on Kick.
// @license      Apache-2.0
// @icon         https://raw.githubusercontent.com/wisnuwirayuda15/kick-extended/main/assets/icon.png
// @homepageURL  https://github.com/wisnuwirayuda15/kick-extended
// @supportURL   https://github.com/wisnuwirayuda15/kick-extended/issues
// @downloadURL  https://github.com/wisnuwirayuda15/kick-extended/releases/latest/download/KickExtended.user.js
// @updateURL    https://github.com/wisnuwirayuda15/kick-extended/releases/latest/download/KickExtended.meta.js
// @match        *://kick.com/*
// @match        *://www.kick.com/*
// @require      https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js
// @connect      kick.com
// @connect      web.kick.com
// @connect      stream.kick.com
// @grant        GM_addStyle
// @grant        GM_info
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_unregisterMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function(hls_js) {
	"use strict";
	var __create = Object.create;
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __getProtoOf = Object.getPrototypeOf;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: ((k) => from[k]).bind(null, key),
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
		value: mod,
		enumerable: true
	}) : target, mod));
	hls_js = __toESM(hls_js);
	var styles_default = "/* Root player.\n   Styled after Kick's own player: a full-width seek bar over one row of 44px\n   buttons with 20px filled icons, on a gradient that fades up from the bottom,\n   a 12px bold clock, and menus on a black panel. */\n#k-player {\n    position: relative; width: 100%; height: 100%; overflow: hidden; background: #000;\n    color: #fff; font-family: Inter, sans-serif; container-type: inline-size;\n}\n#k-video { display: block; width: 100%; height: 100%; object-fit: contain; background: #000; }\n\n#k-controls {\n    position: absolute; left: 0; right: 0; bottom: 0; z-index: 20;\n    display: flex; flex-direction: column;\n    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0));\n    opacity: 0; transition: opacity .2s ease;\n}\n\n/* Seek bar. The 20px strip is the hit area; the visible bar is the 4px at its\n   bottom, 6px while hovered, and runs edge to edge like Kick's. */\n#k-track {\n    --k-progress: 0%;\n    position: relative; height: 20px; margin-bottom: 8px; cursor: pointer; touch-action: none;\n}\n#k-track-bar {\n    position: absolute; left: 0; right: 0; bottom: 0; height: 4px; overflow: hidden;\n    background: rgba(170, 176, 186, 0.5); transition: height .1s ease;\n}\n#k-track:hover #k-track-bar, #k-track.scrubbing #k-track-bar { height: 6px; }\n#k-buffered, #k-progress { position: absolute; top: 0; left: 0; height: 100%; width: 0; }\n#k-buffered { background: rgba(255, 255, 255, 0.3); }\n#k-progress { background: #53fc18; }\n#k-track::after {\n    content: \"\"; position: absolute; left: var(--k-progress); bottom: 3px;\n    width: 16px; height: 16px; border-radius: 50%; background: #53fc18;\n    transform: translate(-50%, 50%) scale(0); transition: transform .1s ease; pointer-events: none;\n}\n#k-track:hover::after, #k-track.scrubbing::after { transform: translate(-50%, 50%) scale(1); }\n#k-track-tooltip {\n    position: absolute; bottom: calc(100% + 4px); left: 0; z-index: 35;\n    padding: 4px; border-radius: 6px; background: rgba(0, 0, 0, 0.8);\n    font-size: 12px; font-weight: 700; line-height: 16px; font-variant-numeric: tabular-nums;\n    white-space: nowrap; pointer-events: none; opacity: 0;\n    transform: translateX(-50%); transition: opacity .1s ease;\n}\n#k-track-tooltip.visible { opacity: 1; }\n\n/* Button row: 8px side padding, 20px on a wide player. */\n#k-controls-row {\n    display: flex; align-items: center; justify-content: space-between; height: 44px; padding: 0 8px;\n}\n#k-controls-left, #k-controls-right { display: flex; align-items: center; min-width: 0; }\n#k-controls-right { flex: 0 0 auto; }\n.k-btn {\n    display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;\n    width: 44px; height: 44px; padding: 0; border: 0; border-radius: 4px;\n    background: transparent; color: #fff; cursor: pointer; transition: transform .1s ease;\n}\n.k-btn svg { width: 20px; height: 20px; }\n.k-btn:active { transform: scale(0.95); }\n.k-btn:focus-visible { outline: 2px solid #53fc18; outline-offset: -2px; }\n#k-time {\n    padding-left: 8px; font-size: 12px; font-weight: 700; line-height: 16px;\n    white-space: nowrap; font-variant-numeric: tabular-nums;\n}\n\n/* Volume: the slider only opens while the volume control is hovered. */\n#k-volume-wrap { display: flex; align-items: center; gap: 8px; }\n#k-volume {\n    --k-volume-percent: 100%;\n    display: none; width: 100px; height: 20px; margin: 0; padding: 0; border: 0;\n    background: transparent; appearance: none; -webkit-appearance: none; cursor: pointer;\n}\n#k-volume-wrap:hover #k-volume { display: block; }\n#k-volume::-webkit-slider-runnable-track {\n    height: 3px; border-radius: 999px;\n    background: linear-gradient(90deg, #fff var(--k-volume-percent), #24272c var(--k-volume-percent));\n}\n#k-volume::-webkit-slider-thumb {\n    -webkit-appearance: none; appearance: none; width: 16px; height: 16px; margin-top: -6.5px;\n    border: 0; border-radius: 50%; background: #fff;\n}\n#k-volume::-moz-range-track { height: 3px; border-radius: 999px; background: #24272c; }\n#k-volume::-moz-range-progress { height: 3px; border-radius: 999px; background: #fff; }\n#k-volume::-moz-range-thumb { width: 16px; height: 16px; border: 0; border-radius: 50%; background: #fff; }\n\n/* Menus: speed, quality and the external-player handoff, in the player and\n   in Kick's own control bar. */\n.k-menu-wrap, .k-ext-wrap { position: relative; display: inline-flex; }\n.k-menu, .k-ext-menu {\n    position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 40;\n    display: none; flex-direction: column; min-width: 212px; max-height: 280px; overflow-y: auto;\n    padding: 4px; border-radius: 8px; background: rgba(0, 0, 0, 0.9);\n    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);\n    color: #fff; font-family: Inter, sans-serif; font-size: 14px; text-align: left;\n}\n.k-menu-wrap.open .k-menu, .k-ext-wrap.open .k-ext-menu { display: flex; }\n.k-menu-option, .k-ext-menu .k-ext-option {\n    display: flex; align-items: center; justify-content: space-between; gap: 16px; flex: 0 0 auto;\n    width: 100%; padding: 8px 12px; border: 0; border-radius: 4px; background: transparent;\n    color: #fff; font-family: inherit; font-size: 14px; font-weight: 400; line-height: 20px;\n    text-align: left; white-space: nowrap; cursor: pointer;\n}\n.k-menu-option:hover, .k-menu-option:focus-visible,\n.k-ext-menu .k-ext-option:hover, .k-ext-menu .k-ext-option:focus-visible {\n    background: rgba(255, 255, 255, 0.1); outline: none;\n}\n.k-menu-option svg { width: 16px; height: 16px; flex: 0 0 auto; visibility: hidden; }\n.k-menu-option.active svg { visibility: visible; }\n.k-ext-menu .k-ext-option.done { color: #53fc18; }\n.k-ext-menu .k-ext-heading {\n    padding: 8px 12px 4px; font-size: 12px; font-weight: 600; color: rgba(255, 255, 255, 0.5);\n}\n\n/* Centre buttons, shown on touch screens only. */\n#k-big-play, .k-center-seek {\n    position: absolute; top: 50%; z-index: 16; display: flex; align-items: center; justify-content: center;\n    padding: 0; border: 0; border-radius: 50%; background: rgba(0, 0, 0, 0.6); color: #fff; cursor: pointer;\n    opacity: 0; pointer-events: none; transform: translate(-50%, -50%) scale(0.92);\n    transition: opacity .15s ease, transform .15s ease;\n}\n#k-big-play { left: 50%; width: 64px; height: 64px; }\n#k-big-play svg { width: 32px; height: 32px; }\n#k-big-play.visible, .k-center-seek.visible {\n    opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1);\n}\n.k-center-seek { width: 48px; height: 48px; flex-direction: column; gap: 1px; }\n.k-center-seek svg { width: 18px; height: 18px; flex-shrink: 0; }\n.k-center-seek.bump { transform: translate(-50%, -50%) scale(0.88); transition-duration: .08s; }\n#k-seek-back { left: calc(50% - 88px); }\n#k-seek-fwd { left: calc(50% + 88px); }\n/* Stacked under the icon, not laid over it: the double arrow fills the\n   circle's centre, so a centred label collides with it. */\n.k-center-seek .k-center-seek-label {\n    font-size: 9px; font-weight: 700; line-height: 1; pointer-events: none;\n}\n\n#k-loading {\n    position: absolute; inset: 0; z-index: 14; display: flex; align-items: center; justify-content: center;\n    opacity: 0; pointer-events: none; transition: opacity .18s ease;\n}\n#k-loading.visible { opacity: 1; }\n.k-loading-spinner {\n    width: 48px; height: 48px; border-radius: 50%;\n    border: 4px solid rgba(255, 255, 255, 0.2); border-top-color: #53fc18;\n    animation: kick-unlocker-spin .8s linear infinite;\n}\n@keyframes kick-unlocker-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\n\n/* Keyboard seek feedback. */\n#k-seek-indicator {\n    position: absolute; top: 50%; left: 50%; z-index: 15; display: flex; align-items: center; justify-content: center;\n    width: 64px; height: 64px; border-radius: 50%; background: rgba(0, 0, 0, 0.6);\n    opacity: 0; pointer-events: none; transform: translate(-50%, -50%) scale(0.92);\n    transition: opacity .15s ease, transform .15s ease;\n}\n#k-seek-indicator svg { width: 28px; height: 28px; }\n#k-seek-indicator[data-direction=\"backward\"] { left: 34%; }\n#k-seek-indicator[data-direction=\"forward\"] { left: 66%; }\n#k-seek-indicator.visible { opacity: 1; transform: translate(-50%, -50%) scale(1); }\n\n/* The player can be narrow because the phone is narrow, or because the chat\n   pane is open on desktop. A container query catches both. These come after\n   the base rules above so they win at equal specificity. */\n@container (min-width: 900px) {\n    #k-controls-row { padding: 0 20px; }\n    #k-volume-wrap { gap: 16px; }\n}\n@container (max-width: 560px) {\n    .k-btn { width: 40px; height: 40px; }\n    #k-controls-row { height: 40px; }\n    #k-volume-wrap:hover #k-volume { display: none; }\n    #k-time { font-size: 11px; }\n    #k-big-play { width: 56px; height: 56px; }\n    #k-big-play svg { width: 28px; height: 28px; }\n    .k-center-seek { width: 40px; height: 40px; }\n    .k-center-seek svg { width: 14px; height: 14px; }\n    .k-center-seek .k-center-seek-label { font-size: 8px; }\n    #k-seek-back { left: calc(50% - 68px); }\n    #k-seek-fwd { left: calc(50% + 68px); }\n}\n@container (max-width: 380px) {\n    .k-btn { width: 36px; height: 36px; }\n    #k-controls-row { height: 36px; padding: 0 4px; }\n    #k-time { font-size: 10px; padding-left: 4px; }\n    #k-seek-back { left: calc(50% - 60px); }\n    #k-seek-fwd { left: calc(50% + 60px); }\n}\n\n#k-copy-url-btn {\n    display: inline-flex; align-items: center; gap: 5px; vertical-align: middle;\n    margin-left: 8px; padding: 3px 8px; border-radius: 7px;\n    border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(255, 255, 255, 0.08);\n    color: rgba(255, 255, 255, 0.75); font-family: Inter, sans-serif; font-size: 11px;\n    font-weight: 500; line-height: 1.4; white-space: nowrap; cursor: pointer;\n    transition: background .15s ease, color .15s ease;\n}\n#k-copy-url-btn:hover { background: rgba(255, 255, 255, 0.16); color: #fff; }\n#k-copy-url-btn[data-state=\"done\"] { color: #53fc18; border-color: rgba(83, 252, 24, 0.4); }\n#k-copy-url-btn[data-state=\"error\"] { color: #ff6b6b; border-color: rgba(255, 107, 107, 0.4); }\n#k-copy-url-btn svg { width: 13px; height: 13px; flex: 0 0 auto; }\n#k-toast {\n    position: fixed; top: 18px; left: 50%; transform: translateX(-50%);\n    z-index: 2147483000; max-width: 90vw; padding: 10px 16px; border-radius: 10px;\n    border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(7, 7, 7, 0.88);\n    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);\n    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);\n    color: #fff; font-family: Inter, sans-serif; font-size: 13px; line-height: 1.4;\n}\n\n/* Download button on each video thumbnail, revealed on hover.\n   Was injected by KickVideoDownloader through its own <style> tag; it now\n   goes through the same GM_addStyle blob as the rest. */\n.k-thumb-dl-btn {\n  position: absolute;\n  top: 6px;\n  right: 6px;\n  z-index: 10;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  padding: 4px;\n  font-size: 18px;\n  color: #fff;\n  background: rgba(0, 0, 0, 0.7);\n  border: none;\n  border-radius: 4px;\n  cursor: pointer;\n  opacity: 0;\n  transition: opacity 0.15s ease-out, background 0.15s ease-out;\n}\na:hover > .k-thumb-dl-btn,\n.k-thumb-dl-btn:focus-visible {\n  opacity: 1;\n}\n.k-thumb-dl-btn:hover {\n  background: rgba(0, 0, 0, 0.9);\n}\n\n/* Watch progress along the bottom of a VOD thumbnail. The card clips it to\n   its own rounded corners. */\n.k-thumb-progress {\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  z-index: 10;\n  height: 4px;\n  background: rgba(255, 255, 255, 0.35);\n  pointer-events: none;\n}\n.k-thumb-progress > div {\n  height: 100%;\n  background: #53fc18;\n}\n\n/* Download dialog and progress panel.\n   Body-level and fixed, sitting at the same z-index as #k-toast: both must\n   escape #k-player, which is removed on SPA navigation and is the only\n   @container context in this file. */\n#k-download-dialog {\n    position: fixed; inset: 0; z-index: 2147483000; display: flex;\n    align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.55);\n    font-family: Inter, sans-serif;\n}\n#k-download-dialog .k-dl-dialog {\n    width: min(420px, 92vw); max-height: 80vh; overflow-y: auto; padding: 16px 18px;\n    border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.18);\n    background: rgba(7, 7, 7, 0.92);\n    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);\n    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55); color: #fff;\n}\n#k-download-dialog .k-dl-heading {\n    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;\n    color: rgba(255, 255, 255, 0.45); margin-bottom: 12px;\n}\n#k-download-dialog .k-dl-note {\n    font-size: 12px; line-height: 1.5; color: rgba(255, 255, 255, 0.7);\n    margin-bottom: 12px;\n}\n#k-download-dialog .k-dl-qualities { display: flex; flex-direction: column; gap: 4px; }\n#k-download-dialog .k-dl-quality {\n    width: 100%; text-align: left; padding: 8px 10px; border-radius: 8px;\n    border: 1px solid transparent; background: rgba(255, 255, 255, 0.06);\n    color: #fff; font-size: 12px; font-family: inherit; cursor: pointer;\n    transition: background .15s ease;\n}\n#k-download-dialog .k-dl-quality:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); }\n#k-download-dialog .k-dl-quality.active {\n    background: rgba(83, 252, 24, 0.08); border-color: rgba(83, 252, 24, 0.4); color: #53fc18;\n}\n#k-download-dialog .k-dl-quality:disabled { opacity: 0.45; cursor: default; }\n#k-download-dialog .k-dl-footer { display: flex; gap: 8px; margin-top: 14px; }\n#k-download-dialog .k-dl-primary,\n#k-download-dialog .k-dl-secondary {\n    padding: 7px 12px; border-radius: 8px; font-size: 12px; font-family: inherit;\n    cursor: pointer; transition: background .15s ease, color .15s ease;\n}\n#k-download-dialog .k-dl-primary {\n    border: 1px solid rgba(83, 252, 24, 0.4); background: rgba(83, 252, 24, 0.12); color: #53fc18;\n}\n#k-download-dialog .k-dl-primary:hover:not(:disabled) { background: rgba(83, 252, 24, 0.2); }\n#k-download-dialog .k-dl-primary:disabled { opacity: 0.5; cursor: default; }\n#k-download-dialog .k-dl-secondary {\n    border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(255, 255, 255, 0.08);\n    color: rgba(255, 255, 255, 0.75); margin-left: auto;\n}\n#k-download-dialog .k-dl-secondary:hover { background: rgba(255, 255, 255, 0.16); color: #fff; }\n\n#k-download-panel {\n    position: fixed; right: 18px; bottom: 18px; z-index: 2147483000; width: 300px;\n    padding: 12px 14px; border-radius: 10px;\n    border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(7, 7, 7, 0.92);\n    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);\n    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);\n    color: #fff; font-family: Inter, sans-serif; font-size: 12px; line-height: 1.4;\n}\n#k-download-panel .k-dl-panel-title {\n    font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n    margin-bottom: 8px;\n}\n#k-download-panel .k-dl-bar {\n    height: 6px; border-radius: 999px; background: rgba(255, 255, 255, 0.15); overflow: hidden;\n}\n#k-download-panel .k-dl-bar-fill {\n    height: 100%; width: 0%; border-radius: 999px;\n    background: linear-gradient(90deg, #53fc18, #9dff57); transition: width .2s ease;\n}\n#k-download-panel[data-state=\"failed\"] .k-dl-bar-fill { background: #ff6b6b; }\n#k-download-panel .k-dl-panel-detail {\n    margin: 8px 0 10px; color: rgba(255, 255, 255, 0.75);\n    font-variant-numeric: tabular-nums;\n}\n#k-download-panel .k-dl-panel-action {\n    padding: 5px 10px; border-radius: 7px; border: 1px solid rgba(255, 255, 255, 0.18);\n    background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.75);\n    font-size: 11px; font-family: inherit; cursor: pointer;\n}\n#k-download-panel .k-dl-panel-action:hover:not(:disabled) {\n    background: rgba(255, 255, 255, 0.16); color: #fff;\n}\n#k-download-panel .k-dl-panel-action:disabled { opacity: 0.5; cursor: default; }\n";
	var SUBSCRIBER_ONLY_SELECTOR = "[data-testid=\"video-subscriber-only\"]";
	var CONTROL_ANCHOR_SELECTOR = "button:has(> svg[data-ds-icon=\"FullscreenExpand\"])";
	var BADGE_SELECTOR = "svg[data-ds-icon=\"VerifiedBadge\"]";
	var CHANNEL_NAME_SELECTOR = "h1#channel-username";
	var NATIVE_VIDEO_SELECTOR = "#video-player";
	var NATIVE_VIDEO_FALLBACK_SELECTOR = "video:not(#k-video)";
	var PLAYER_CONTAINER_SELECTOR = ".relative.flex.flex-col";
	var SUBSCRIBER_OVERLAY_CONTAINER_SELECTOR = ".relative.flex.flex-col.items-center.justify-center.overflow-hidden.rounded";
	var KICK_CHAT_SELECTOR = "#chatroom-messages";
	var STORAGE_PREFIX = "kick_extended_";
	var LEGACY_STORAGE_PREFIX = "kick_unlocker_";
	var CUSTOM_PLAYER_OFF_KEY = `${STORAGE_PREFIX}custom_player_off`;
	var DISABLE_SPA_KEY = `${STORAGE_PREFIX}disable_spa`;
	var VOD_PATH_REGEX = /^\/[^/]+\/videos?\/[^/]+\/?$/;
	var DOWNLOAD_BUTTON_ID = "k-download-btn";
	var THUMB_DOWNLOAD_BUTTON_CLASS = "k-thumb-dl-btn";
	var THUMB_INJECTED_FLAG = "kDlInjected";
	var THUMB_PROGRESS_CLASS = "k-thumb-progress";
	var THUMB_PROGRESS_FLAG = "kProgressFor";
	var KICK_MENU_SELECTOR = "[role=\"menu\"][aria-labelledby]";
	var PROGRESS_MENU_ITEM_CLASS = "k-progress-menu-item";
	var PROGRESS_MENU_FLAG = "kProgressMenu";
	var DOWNLOAD_DIALOG_ID = "k-download-dialog";
	var DOWNLOAD_PANEL_ID = "k-download-panel";
	var state = {
		activeHls: null,
		activeChatController: null,
		nativeExternalCache: null,
		isUnlocking: false,
		activePlayerUi: null,
		pendingStream: null,
		prefetchedKey: null,
		customPlayerFailedKey: null,
		activeDownload: null
	};
	function gmFetch(url, opts = {}) {
		return new Promise((resolve, reject) => {
			GM_xmlhttpRequest({
				method: opts.method || "GET",
				url,
				headers: opts.headers || {},
				data: opts.body,
				timeout: opts.timeout || 15e3,
				onload: (r) => resolve({
					ok: r.status >= 200 && r.status < 300,
					status: r.status,
					json: () => JSON.parse(r.responseText),
					text: () => r.responseText
				}),
				onerror: () => reject(new Error("network")),
				ontimeout: () => reject(new Error("timeout"))
			});
		});
	}
	function checkStreamUrl(url) {
		return new Promise((resolve) => {
			GM_xmlhttpRequest({
				method: "HEAD",
				url,
				timeout: 3e3,
				onload: (r) => resolve(r.status >= 200 && r.status < 300 ? url : null),
				onerror: () => resolve(null),
				ontimeout: () => resolve(null)
			});
		});
	}
	async function getVideoMetadata(channelSlug, videoSlug) {
		try {
			const chRes = await gmFetch(`https://kick.com/api/v2/channels/${channelSlug}`);
			if (!chRes.ok) return null;
			const chData = chRes.json();
			const channelId = chData.id;
			const vidRes = await gmFetch(`https://web.kick.com/api/v1/channels/${channelId}/videos`, { headers: {
				Accept: "application/json",
				"Alt-Used": "web.kick.com",
				Origin: "https://kick.com",
				Referer: "https://kick.com/"
			} });
			if (!vidRes.ok) return null;
			const vidData = vidRes.json();
			let videosList = vidData.data || vidData.videos || [];
			if (Array.isArray(vidData)) videosList = vidData;
			const targetVideo = videosList.find((v) => String(v.id) === videoSlug);
			if (!targetVideo) return null;
			return {
				video: targetVideo,
				channelId,
				channelSlug,
				channelName: chData.user?.username || chData.slug || channelSlug
			};
		} catch (e) {
			return null;
		}
	}
	function parseStartTime(value) {
		const text = String(value || "").replace(" ", "T");
		return new Date(text + (text.endsWith("Z") ? "" : "Z"));
	}
	function parseIvsThumbnail(thumbUrl) {
		const parts = String(thumbUrl || "").split("/");
		const idx = parts.indexOf("video_thumbnails");
		if (idx === -1 || idx + 2 >= parts.length) return null;
		return {
			sessionId: parts[idx + 1],
			segmentId: parts[idx + 2]
		};
	}
	async function mintPlaybackUrl(videoId, channelSlug) {
		try {
			const res = await gmFetch(`https://web.kick.com/api/v1/stream/${videoId}/playback`, {
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
					Origin: "https://kick.com",
					Referer: "https://kick.com/"
				},
				body: JSON.stringify({
					video_player: {
						player: {
							player_name: "web",
							player_version: "1.0.0",
							player_software: "IVS Player",
							player_software_version: "1.28.0"
						},
						mux_sdk: { sdk_available: false },
						pal_sdk: {
							sdk_available: false,
							nonce: ""
						},
						datazoom_sdk: {
							sdk_available: false,
							datazoom_sdk_version: "",
							om_sdk_version: ""
						},
						google_ads_sdk: { sdk_available: false }
					},
					video_session: {
						page_type: "vod",
						player_remote_played: false,
						enable_sampling: false,
						url_path: `/${channelSlug}/videos/${videoId}`,
						autoplay_behaviour: "auto",
						play_muted: false,
						viewer_connection_type: ""
					},
					user_session: {
						session_id: "",
						player_device_id: "unknown",
						browser_lang: navigator.language || "en-US",
						non_personalised_ads: false,
						ad_targeting: ""
					}
				})
			});
			if (!res.ok) return null;
			return res.json()?.playback_url?.vod || null;
		} catch (e) {
			return null;
		}
	}
	async function findLegacyThumbnail(channelSlug, startTime) {
		try {
			const res = await gmFetch(`https://kick.com/api/v1/channels/${channelSlug}`);
			if (!res.ok) return "";
			return (res.json().previous_livestreams || []).find((entry) => parseStartTime(entry.start_time).getTime() === startTime.getTime())?.thumbnail?.src || "";
		} catch (e) {
			return "";
		}
	}
	async function findStreamUrlFromMetadata(metadata) {
		const { video, channelSlug } = metadata;
		if (!video) return null;
		const minted = await mintPlaybackUrl(video.id, channelSlug);
		if (minted) return minted;
		const startTime = parseStartTime(video.start_time);
		const thumbUrl = video.thumbnail && video.thumbnail.src ? video.thumbnail.src : "";
		const ivs = parseIvsThumbnail(thumbUrl) || parseIvsThumbnail(await findLegacyThumbnail(channelSlug, startTime));
		if (!ivs) {
			console.error("Kick Extended: Could not parse session/segment from thumbnail", thumbUrl);
			return null;
		}
		const { sessionId, segmentId } = ivs;
		const baseUrls = [
			"https://stream.kick.com/ivs/v1/196233775518",
			"https://stream.kick.com/3c81249a5ce0/ivs/v1/196233775518",
			"https://stream.kick.com/0f3cb0ebce7/ivs/v1/196233775518"
		];
		const tasks = [];
		for (const offset of [
			0,
			1,
			-1,
			2,
			-2,
			3,
			-3,
			4,
			-4,
			5,
			-5
		]) {
			const t = new Date(startTime.getTime() + offset * 6e4);
			const y = t.getUTCFullYear();
			const m = t.getUTCMonth() + 1;
			const d = t.getUTCDate();
			const h = t.getUTCHours();
			const min = t.getUTCMinutes();
			for (const base of baseUrls) tasks.push(`${base}/${sessionId}/${y}/${m}/${d}/${h}/${min}/${segmentId}/media/hls/master.m3u8`);
		}
		for (const url of tasks) if (await checkStreamUrl(url)) return url;
		return null;
	}
	function resolveStream(channelSlug, videoSlug) {
		const key = `${channelSlug}/${videoSlug}`;
		if (state.pendingStream?.key !== key) {
			const promise = resolveStreamUncached(channelSlug, videoSlug).then((resolved) => {
				if (!resolved && state.pendingStream?.promise === promise) state.pendingStream = null;
				return resolved;
			});
			state.pendingStream = {
				key,
				promise
			};
		}
		return state.pendingStream.promise;
	}
	async function resolveStreamUncached(channelSlug, videoSlug) {
		try {
			const result = await getVideoMetadata(channelSlug, videoSlug);
			if (!result) return null;
			const streamUrl = await findStreamUrlFromMetadata(result);
			if (!streamUrl) return null;
			return {
				result,
				streamUrl
			};
		} catch (e) {
			return null;
		}
	}
	function isVodPage() {
		return VOD_PATH_REGEX.test(window.location.pathname);
	}
	function getNativeVideo() {
		const byId = document.querySelector(NATIVE_VIDEO_SELECTOR);
		if (byId && byId.id !== "k-video") return byId;
		return document.querySelector(NATIVE_VIDEO_FALLBACK_SELECTOR);
	}
	function isNativePlayerVisible() {
		const nativeVideo = getNativeVideo();
		if (!nativeVideo) return false;
		const rect = nativeVideo.getBoundingClientRect();
		return rect.width >= 120 && rect.height >= 70;
	}
	function findCopyButtonAnchor() {
		const badge = document.querySelector(BADGE_SELECTOR);
		if (badge?.parentElement) return badge;
		return document.querySelector(CHANNEL_NAME_SELECTOR);
	}
	function isPageLayout(node) {
		if (node.tagName === "MAIN") return true;
		if (node.querySelector("h1#channel-username")) return true;
		const { overflowY } = getComputedStyle(node);
		return overflowY === "auto" || overflowY === "scroll";
	}
	function findNativePlayerContainer() {
		const nativeVideo = getNativeVideo();
		if (!nativeVideo) return null;
		const classMatch = nativeVideo.closest(PLAYER_CONTAINER_SELECTOR);
		if (classMatch) return classMatch;
		const videoRect = nativeVideo.getBoundingClientRect();
		let node = nativeVideo.parentElement;
		let bestMatch = nativeVideo.parentElement;
		while (node && node !== document.body) {
			if (isPageLayout(node)) break;
			const rect = node.getBoundingClientRect();
			if (rect.width > videoRect.width * 1.15 || rect.height > videoRect.height * 1.3) break;
			bestMatch = node;
			node = node.parentElement;
		}
		return bestMatch;
	}
	function getVodSlugs(pathname = window.location.pathname) {
		const pathParts = pathname.split("/").filter(Boolean);
		const channelSlug = pathParts[0];
		const videoSlug = pathParts[2];
		return {
			channelSlug,
			videoSlug,
			cacheKey: `${channelSlug}/${videoSlug}`
		};
	}
	function ensureCopyUrlButton() {
		if (!isVodPage()) return;
		if (document.querySelector("#k-copy-url-btn")) return;
		const anchor = findCopyButtonAnchor();
		if (!anchor?.parentElement) return;
		const button = document.createElement("button");
		button.id = "k-copy-url-btn";
		button.type = "button";
		button.title = "Copy stream URL (.m3u8)";
		const defaultLabel = "Copy stream URL";
		button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>${defaultLabel}</span>`;
		const setLabel = (text, state) => {
			button.querySelector("span").textContent = text;
			if (state) button.dataset.state = state;
			else delete button.dataset.state;
		};
		button.addEventListener("click", async (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (button.dataset.busy === "1") return;
			const { channelSlug, videoSlug, cacheKey } = getVodSlugs();
			if (state.nativeExternalCache?.key !== cacheKey) {
				button.dataset.busy = "1";
				setLabel("Loading...", null);
				const resolved = await resolveStream(channelSlug, videoSlug);
				delete button.dataset.busy;
				if (!resolved) {
					setLabel("Stream not found", "error");
					setTimeout(() => setLabel(defaultLabel, null), 2500);
					return;
				}
				state.nativeExternalCache = {
					key: cacheKey,
					...resolved
				};
			}
			GM_setClipboard(state.nativeExternalCache.streamUrl, "text");
			setLabel("Copied", "done");
			setTimeout(() => setLabel(defaultLabel, null), 1600);
		});
		anchor.parentElement.insertBefore(button, anchor.nextSibling);
	}
	var ChatController = class {
		constructor(channelId, videoStartTime, container) {
			this.channelId = channelId;
			this.videoStartTime = videoStartTime;
			this.container = container;
			this.messages = [];
			this.videoElement = null;
			this.activeSessionId = 0;
		}
		stop() {
			this.activeSessionId++;
			this.videoElement = null;
		}
		init(initialVideoElement = null) {
			if (this.container) {
				this.container.innerHTML = `
              <div style="height:100%;display:flex;flex-direction:column;font-family:Inter,sans-serif;">
                  <div id="kick-unlocker-chat-list" style="flex:1;overflow-y:auto;padding:10px;font-size:13px;color:#fff;">
                      <br><div style="text-align:center;color:#888;">Connecting...</div>
                  </div>
              </div>`;
				this.chatList = this.container.querySelector("#kick-unlocker-chat-list");
			}
			if (initialVideoElement) this.connectVideo(initialVideoElement);
			this.fetchLoop(this.activeSessionId);
		}
		connectVideo(videoElement) {
			this.videoElement = videoElement;
			videoElement.addEventListener("timeupdate", () => this.updateUI(videoElement.currentTime));
			videoElement.addEventListener("seeking", () => {
				this.activeSessionId++;
				this.messages = [];
				if (this.chatList) this.chatList.innerHTML = "<br><div style=\"text-align:center;color:#888;\">Syncing...</div>";
				this.fetchLoop(this.activeSessionId);
			});
		}
		parseContent(content) {
			if (!content) return "";
			return content.replace(/\[emote:(\d+):([^\]]+)\]/g, (match, id, name) => `<img src="https://files.kick.com/emotes/${id}/fullsize" alt="${name}" title="${name}" style="height:1.8em;vertical-align:middle;display:inline-block;margin:0 2px;">`);
		}
		async fetchLoop(sessionId) {
			let currentCursor = null;
			while (this.activeSessionId === sessionId) try {
				let url = `https://kick.com/api/v2/channels/${this.channelId}/messages`;
				if (currentCursor) url += `?cursor=${currentCursor}`;
				else {
					let targetTime = this.videoStartTime;
					if (this.videoElement) targetTime = new Date(this.videoStartTime.getTime() + this.videoElement.currentTime * 1e3);
					url += `?start_time=${targetTime.toISOString()}`;
				}
				const res = await gmFetch(url);
				if (!res.ok) {
					await new Promise((r) => setTimeout(r, 2e3));
					continue;
				}
				const data = res.json();
				if (this.activeSessionId !== sessionId) break;
				const msgs = data.messages || data.data && data.data.messages || [];
				if (msgs.length) {
					msgs.forEach((msg) => {
						if (!this.messages.some((m) => m.id === msg.id)) this.messages.push(msg);
					});
					this.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
					if (this.videoElement) this.updateUI(this.videoElement.currentTime);
				}
				currentCursor = data.cursor || data.data && data.data.cursor || data.next_cursor;
				if (!currentCursor) {
					currentCursor = null;
					await new Promise((r) => setTimeout(r, 2e3));
				} else if (this.messages.length && this.videoElement) {
					if (new Date(this.messages[this.messages.length - 1].created_at).getTime() > this.videoStartTime.getTime() + this.videoElement.currentTime * 1e3 + 6e4) await new Promise((r) => setTimeout(r, 1e3));
					else await new Promise((r) => setTimeout(r, 50));
				} else await new Promise((r) => setTimeout(r, 50));
			} catch (e) {
				await new Promise((r) => setTimeout(r, 2e3));
			}
		}
		updateUI(cwdSeconds) {
			if (!this.chatList) return;
			const absTime = this.videoStartTime.getTime() + cwdSeconds * 1e3;
			let limit = -1;
			for (let i = this.messages.length - 1; i >= 0; i--) if (new Date(this.messages[i].created_at).getTime() <= absTime) {
				limit = i;
				break;
			}
			if (limit === -1) return;
			const subset = this.messages.slice(Math.max(0, limit - 75), limit + 1);
			const lastM = subset[subset.length - 1];
			if (!lastM || this.lastRenderedMsgId === lastM.id && subset.length >= 50) return;
			this.chatList.innerHTML = subset.map((msg) => `
          <div style="margin-bottom:4px;line-height:1.4;word-wrap:break-word;">
              <span style="color:${msg.sender.identity?.color || "#53fc18"};font-weight:bold;margin-right:5px;">${msg.sender.username}:</span>
              <span style="color:#efeff1;">${this.parseContent(msg.content)}</span>
          </div>`).join("");
			this.chatList.scrollTop = this.chatList.scrollHeight;
			this.lastRenderedMsgId = lastM.id;
		}
	};
	function legacyKeyFor(key) {
		return key.startsWith("kick_extended_") ? LEGACY_STORAGE_PREFIX + key.slice(STORAGE_PREFIX.length) : key;
	}
	function readMigrated(key) {
		const current = localStorage.getItem(key);
		if (current !== null) return current;
		const legacyKey = legacyKeyFor(key);
		if (legacyKey === key) return null;
		const legacyValue = localStorage.getItem(legacyKey);
		if (legacyValue === null) return null;
		localStorage.setItem(key, legacyValue);
		localStorage.removeItem(legacyKey);
		return legacyValue;
	}
	function removeBoth(key) {
		localStorage.removeItem(key);
		localStorage.removeItem(legacyKeyFor(key));
	}
	function getResumeKey(channelSlug, videoSlug) {
		return `${STORAGE_PREFIX}resume:${channelSlug}:${videoSlug}`;
	}
	function getPlayerSettingsKey(channelSlug, videoSlug) {
		return `${STORAGE_PREFIX}settings:${channelSlug}:${videoSlug}`;
	}
	function loadPlayerSettings(settingsKey) {
		try {
			const raw = readMigrated(settingsKey);
			return raw ? JSON.parse(raw) : {};
		} catch (e) {
			return {};
		}
	}
	function savePlayerSettings(settingsKey, partialSettings) {
		const currentSettings = loadPlayerSettings(settingsKey);
		localStorage.setItem(settingsKey, JSON.stringify({
			...currentSettings,
			...partialSettings
		}));
	}
	function readResumeTime(resumeKey) {
		return readMigrated(resumeKey);
	}
	function saveResumeTime(resumeKey, currentTime) {
		localStorage.setItem(resumeKey, currentTime);
	}
	function clearResumeTime(resumeKey) {
		removeBoth(resumeKey);
	}
	function getProgressKey(channelSlug, videoSlug) {
		return `${STORAGE_PREFIX}progress:${channelSlug}:${videoSlug}`;
	}
	function readWatchProgress(progressKey) {
		try {
			const parsed = JSON.parse(localStorage.getItem(progressKey) || "null");
			const time = Number(parsed?.time);
			const duration = Number(parsed?.duration);
			if (!Number.isFinite(time) || !Number.isFinite(duration)) return null;
			if (duration <= 0) return null;
			return {
				time,
				duration
			};
		} catch (e) {
			return null;
		}
	}
	function saveWatchProgress(progressKey, time, duration) {
		if (!Number.isFinite(time) || !Number.isFinite(duration)) return;
		if (duration <= 0) return;
		localStorage.setItem(progressKey, JSON.stringify({
			time,
			duration
		}));
	}
	function clearWatchProgress(progressKey) {
		localStorage.removeItem(progressKey);
	}
	function isCustomPlayerEnabled() {
		return localStorage.getItem(CUSTOM_PLAYER_OFF_KEY) !== "1";
	}
	function setCustomPlayerEnabled(enabled) {
		if (enabled) localStorage.removeItem(CUSTOM_PLAYER_OFF_KEY);
		else localStorage.setItem(CUSTOM_PLAYER_OFF_KEY, "1");
	}
	function getSpaDisabled() {
		return localStorage.getItem(DISABLE_SPA_KEY) === "1";
	}
	function setSpaDisabled(disabled) {
		if (disabled) localStorage.setItem(DISABLE_SPA_KEY, "1");
		else localStorage.removeItem(DISABLE_SPA_KEY);
	}
	function showToast(message, duration = 5e3) {
		document.querySelector("#k-toast")?.remove();
		const toast = document.createElement("div");
		toast.id = "k-toast";
		toast.textContent = message;
		document.body.appendChild(toast);
		setTimeout(() => toast.remove(), duration);
	}
	var guarding = false;
	var held = new Map();
	function isNativeVideo(target) {
		return target instanceof HTMLVideoElement && target.id !== "k-video";
	}
	function hush(video) {
		if (!guarding) return;
		if (!held.has(video)) held.set(video, video.muted);
		video.muted = true;
		try {
			video.pause();
		} catch (e) {}
	}
	function onPlay(event) {
		if (isNativeVideo(event.target)) hush(event.target);
	}
	function stopNativePlayback(scope) {
		guarding = true;
		(scope || document).querySelectorAll("video").forEach((videoElement) => {
			if (!isNativeVideo(videoElement)) return;
			hush(videoElement);
			videoElement.addEventListener("play", onPlay);
			videoElement.addEventListener("playing", onPlay);
			try {
				videoElement.removeAttribute("src");
				videoElement.load();
			} catch (e) {}
		});
	}
	function releaseNativePlayback() {
		guarding = false;
		held.forEach((wasMuted, video) => {
			video.removeEventListener("play", onPlay);
			video.removeEventListener("playing", onPlay);
			video.muted = wasMuted;
		});
		held.clear();
	}
	function installNativePlaybackGuard() {
		document.addEventListener("play", onPlay, true);
		document.addEventListener("playing", onPlay, true);
	}
	var filled = (paths) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${paths}</svg>`;
	var play = filled(`<path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18a1 1 0 0 0 0-1.69L9.54 5.98A.998.998 0 0 0 8 6.82z"/>`);
	var pause = filled(`<path d="M8 19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2v10c0 1.1.9 2 2 2zm6-12v10c0 1.1.9 2 2 2s2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2z"/>`);
	var ICONS = {
		play,
		pause,
		external: filled(`<path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>`),
		fullscreen: filled(`<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>`),
		fullscreenExit: filled(`<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>`),
		speed: filled(`<path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/>`),
		settings: filled(`<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L5.09 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.58 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>`),
		check: filled(`<path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>`),
		volumeHigh: filled(`<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>`),
		volumeMedium: filled(`<path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>`),
		volumeLow: filled(`<path d="M7 9v6h4l5 5V4l-5 5H7z"/>`),
		volumeMute: filled(`<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/>`),
		bigPlay: play,
		bigPause: pause,
		backward: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 6a2 2 0 0 0-3.414-1.414l-6 6a2 2 0 0 0 0 2.828l6 6A2 2 0 0 0 12 18z"/><path d="M22 6a2 2 0 0 0-3.414-1.414l-6 6a2 2 0 0 0 0 2.828l6 6A2 2 0 0 0 22 18z"/></svg>`,
		forward: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 12 18z"/><path d="M2 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 2 18z"/></svg>`
	};
	function formatTime(seconds) {
		if (!isFinite(seconds) || seconds < 0) return "0:00";
		const h = Math.floor(seconds / 3600);
		const m = Math.floor(seconds % 3600 / 60);
		const s = Math.floor(seconds % 60);
		if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
		else return `${m}:${s.toString().padStart(2, "0")}`;
	}
	function formatClock(seconds) {
		const total = isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
		const pad = (value) => String(value).padStart(2, "0");
		const h = Math.floor(total / 3600);
		const m = Math.floor(total % 3600 / 60);
		const s = total % 60;
		return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
	}
	function getVolumeIcon(volume) {
		if (volume <= 0) return ICONS.volumeMute;
		if (volume < .2) return ICONS.volumeLow;
		if (volume < .5) return ICONS.volumeMedium;
		return ICONS.volumeHigh;
	}
	function makeVideoTitle(result) {
		return (result?.video?.title || result?.video?.session_title || document.title || "kick-vod").replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 80) || "kick-vod";
	}
	function launchScheme(schemeUrl) {
		const anchor = document.createElement("a");
		anchor.href = schemeUrl;
		anchor.style.display = "none";
		document.body.appendChild(anchor);
		anchor.click();
		setTimeout(() => anchor.remove(), 0);
	}
	function downloadPlaylist(externalUrl, videoTitle) {
		const playlist = [
			"#EXTM3U",
			`#EXTINF:-1,${videoTitle}`,
			externalUrl,
			""
		].join("\n");
		const blobUrl = URL.createObjectURL(new Blob([playlist], { type: "audio/x-mpegurl" }));
		const anchor = document.createElement("a");
		anchor.href = blobUrl;
		anchor.download = `${videoTitle}.m3u`;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(blobUrl), 1e4);
	}
	function buildExternalTargets(externalUrl, videoTitle) {
		return [
			{
				group: "Always works",
				label: "Copy stream URL",
				run: () => GM_setClipboard(externalUrl, "text"),
				feedback: "Copied"
			},
			{
				label: "Download .m3u playlist",
				run: () => downloadPlaylist(externalUrl, videoTitle),
				feedback: "Saved"
			},
			{
				group: "Needs a registered handler",
				label: "VLC",
				run: () => launchScheme(`vlc://${externalUrl}`)
			},
			{
				label: "PotPlayer",
				run: () => launchScheme(`potplayer://${externalUrl}`)
			},
			{
				label: "IINA (macOS)",
				run: () => launchScheme(`iina://weblink?url=${encodeURIComponent(externalUrl)}`)
			},
			{
				label: "mpv (mpv-handler)",
				run: () => {
					launchScheme(`mpv://play/${btoa(externalUrl).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}/`);
				}
			}
		];
	}
	function populateExternalMenu(menuElement, targets, closeMenu) {
		menuElement.innerHTML = "";
		let feedbackTimeout = null;
		targets.forEach((target) => {
			if (target.group) {
				const heading = document.createElement("div");
				heading.className = "k-ext-heading";
				heading.textContent = target.group;
				menuElement.appendChild(heading);
			}
			const option = document.createElement("button");
			option.type = "button";
			option.className = "k-ext-option";
			option.textContent = target.label;
			option.addEventListener("click", (event) => {
				event.stopPropagation();
				target.run();
				if (!target.feedback) {
					closeMenu();
					return;
				}
				option.textContent = target.feedback;
				option.classList.add("done");
				clearTimeout(feedbackTimeout);
				feedbackTimeout = setTimeout(() => {
					option.textContent = target.label;
					option.classList.remove("done");
					closeMenu();
				}, 1100);
			});
			menuElement.appendChild(option);
		});
	}
	function buildSplashMarkup(fallbackMinHeight) {
		return `
            <div style="width:100%;height:100%;min-height:${fallbackMinHeight}px;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Inter,sans-serif;">
                <div style="font-size:18px;color:rgba(255,255,255,0.7);">Loading stream...</div>
            </div>
        `;
	}
	function buildStreamNotFoundMarkup() {
		return `
              <div style="width:100%;height:100%;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Inter,sans-serif;">
                  <div style="font-size:20px;color:rgba(255,255,255,0.7);font-weight:bold;">Stream Not Found</div>
              </div>`;
	}
	function buildChatShellMarkup() {
		return `<div style="display:flex;width:100%;height:100%;"><div id="unlocker-video-area" style="flex:1;background:#000;position:relative;"></div><div id="unlocker-chat-area" style="width:320px;height:100%;border-left:1px solid #333;"></div></div>`;
	}
	function buildPlayerMarkup() {
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
	function buildMenuOption(label) {
		const option = document.createElement("button");
		option.type = "button";
		option.className = "k-menu-option";
		option.setAttribute("role", "menuitemradio");
		option.innerHTML = `<span></span>${ICONS.check}`;
		option.querySelector("span").textContent = label;
		return option;
	}
	var globalPlayerListenersBound = false;
	function bindGlobalPlayerListeners() {
		if (globalPlayerListenersBound) return;
		document.addEventListener("click", (event) => {
			(state.activePlayerUi?.menuWraps || []).forEach((wrap) => {
				if (!wrap.isConnected) return;
				if (!wrap.contains(event.target)) wrap.classList.remove("open");
			});
		});
		document.addEventListener("pointerup", (event) => {
			const focusHolder = event.target?.closest?.("#k-controls button, #k-controls input, #k-big-play, .k-center-seek");
			if (focusHolder) focusHolder.blur();
		});
		document.addEventListener("keydown", (event) => {
			const playerUi = state.activePlayerUi;
			const videoElement = playerUi?.vid;
			if (!videoElement || !videoElement.isConnected) return;
			if (event.ctrlKey || event.metaKey || event.altKey) return;
			const target = event.target;
			if (target?.isContentEditable || [
				"INPUT",
				"TEXTAREA",
				"SELECT"
			].includes(target?.tagName)) return;
			const seekBy = (seconds) => {
				if (!isFinite(videoElement.duration)) return;
				videoElement.currentTime = Math.min(Math.max(videoElement.currentTime + seconds, 0), videoElement.duration);
				playerUi.showSeekIndicator(seconds > 0 ? "forward" : "backward");
				playerUi.renderProgress?.(videoElement.currentTime);
			};
			const seekToPercent = (percent) => {
				if (!isFinite(videoElement.duration)) return;
				const target = videoElement.duration * percent;
				const direction = target > videoElement.currentTime ? "forward" : "backward";
				videoElement.currentTime = target;
				playerUi.showSeekIndicator(direction);
				playerUi.renderProgress?.(target);
			};
			const nudgeVolume = (delta) => playerUi.applyVolume(Math.min(Math.max(videoElement.volume + delta, 0), 1));
			const setRate = (delta) => {
				videoElement.playbackRate = Math.min(Math.max(videoElement.playbackRate + delta, .25), 4);
			};
			const shortcuts = {
				arrowright: () => seekBy(5),
				arrowleft: () => seekBy(-5),
				l: () => seekBy(10),
				j: () => seekBy(-10),
				arrowup: () => nudgeVolume(.05),
				arrowdown: () => nudgeVolume(-.05),
				" ": () => playerUi.togglePlay(),
				k: () => playerUi.togglePlay(),
				f: () => playerUi.btnFs.click(),
				m: () => playerUi.applyVolume(videoElement.volume === 0 ? .5 : 0),
				">": () => setRate(.25),
				".": () => setRate(.25),
				"<": () => setRate(-.25),
				",": () => setRate(-.25),
				home: () => seekToPercent(0),
				end: () => seekToPercent(.999)
			};
			for (let digit = 0; digit <= 9; digit++) shortcuts[String(digit)] = () => seekToPercent(digit / 10);
			const action = shortcuts[event.key.toLowerCase()];
			if (!action) return;
			event.preventDefault();
			event.stopPropagation();
			action();
			playerUi.showControls?.();
		}, true);
		globalPlayerListenersBound = true;
	}
	var PLAYBACK_RATES = [
		.25,
		.5,
		.75,
		1,
		1.25,
		1.5,
		2
	];
	function createControls({ videoParent, replaceNative, resumeKey, progressKey, playerSettingsKey, savedPlayerSettings, streamUrl, result, chatController }) {
		const pRoot = videoParent.querySelector("#k-player");
		const vid = videoParent.querySelector("#k-video");
		const controls = videoParent.querySelector("#k-controls");
		const btnPlay = videoParent.querySelector("#k-play");
		const btnFs = videoParent.querySelector("#k-fs");
		const btnBig = videoParent.querySelector("#k-big-play");
		const btnSeekBack = videoParent.querySelector("#k-seek-back");
		const btnSeekFwd = videoParent.querySelector("#k-seek-fwd");
		const progressBar = videoParent.querySelector("#k-progress");
		const bufferedBar = videoParent.querySelector("#k-buffered");
		const track = videoParent.querySelector("#k-track");
		const trackTooltip = videoParent.querySelector("#k-track-tooltip");
		const trackTooltipTime = videoParent.querySelector("#k-track-tooltip-time");
		const timeDisplay = videoParent.querySelector("#k-time");
		const qualWrap = videoParent.querySelector("#k-quality-wrap");
		const extWrap = videoParent.querySelector("#k-ext-wrap");
		const extBtn = videoParent.querySelector("#k-ext-btn");
		const extMenu = videoParent.querySelector("#k-ext-menu");
		const qualBtn = videoParent.querySelector("#k-quality-btn");
		const qualMenu = videoParent.querySelector("#k-quality-menu");
		const speedWrap = videoParent.querySelector("#k-speed-wrap");
		const speedBtn = videoParent.querySelector("#k-speed-btn");
		const speedMenu = videoParent.querySelector("#k-speed-menu");
		const menuWraps = [
			extWrap,
			speedWrap,
			qualWrap
		];
		const seekIndicator = videoParent.querySelector("#k-seek-indicator");
		const loadingOverlay = videoParent.querySelector("#k-loading");
		const volumeWrap = videoParent.querySelector("#k-volume-wrap");
		const volumeButton = videoParent.querySelector("#k-volume-btn");
		const volumeSlider = videoParent.querySelector("#k-volume");
		const initialVolume = Number.isFinite(savedPlayerSettings.volume) ? savedPlayerSettings.volume : 1;
		let seekIndicatorTimeout = null;
		let hasStartedPlayback = false;
		let loadingStateTimeout = null;
		let previousVolumeBeforeMute = initialVolume > 0 ? initialVolume : 1;
		const updateVolumeSliderVisual = (volume) => {
			const percent = Math.max(0, Math.min(100, Math.round(volume * 100)));
			volumeSlider.style.setProperty("--k-volume-percent", `${percent}%`);
			volumeButton.innerHTML = getVolumeIcon(volume);
			volumeButton.setAttribute("aria-label", percent === 0 ? "Unmute" : "Mute");
			volumeWrap.dataset.muted = percent === 0 ? "true" : "false";
		};
		const applyVolume = (volume, { persist = true } = {}) => {
			const normalizedVolume = Math.max(0, Math.min(1, Number(volume) || 0));
			if (normalizedVolume > 0) previousVolumeBeforeMute = normalizedVolume;
			vid.muted = normalizedVolume === 0;
			vid.volume = normalizedVolume;
			volumeSlider.value = String(normalizedVolume);
			updateVolumeSliderVisual(normalizedVolume);
			if (persist) savePlayerSettings(playerSettingsKey, { volume: normalizedVolume });
		};
		const setLoadingState = (isLoading, { immediate = false } = {}) => {
			clearTimeout(loadingStateTimeout);
			if (!isLoading) {
				loadingOverlay.classList.remove("visible");
				return;
			}
			if (immediate) {
				loadingOverlay.classList.add("visible");
				return;
			}
			loadingStateTimeout = setTimeout(() => {
				if (!vid.paused && !vid.ended && isBuffering()) loadingOverlay.classList.add("visible");
			}, 250);
		};
		const isBuffering = () => vid.seeking || vid.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
		const showSeekIndicator = (direction) => {
			seekIndicator.innerHTML = direction === "forward" ? ICONS.forward : ICONS.backward;
			seekIndicator.dataset.direction = direction;
			seekIndicator.classList.remove("visible");
			seekIndicator.offsetWidth;
			seekIndicator.classList.add("visible");
			clearTimeout(seekIndicatorTimeout);
			seekIndicatorTimeout = setTimeout(() => {
				seekIndicator.classList.remove("visible");
			}, 850);
		};
		const CONTROLS_HIDE_DELAY = 2500;
		let controlsHideTimeout = null;
		let pointerOverControls = false;
		let controlsShown = false;
		let controlsShownAtGestureStart = false;
		let lastPointerType = "mouse";
		let touchMode = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
		const closeMenus = () => menuWraps.forEach((wrap) => wrap.classList.remove("open"));
		const isAnyMenuOpen = () => menuWraps.some((wrap) => wrap.classList.contains("open"));
		const toggleMenu = (wrap) => {
			const opening = !wrap.classList.contains("open");
			closeMenus();
			wrap.classList.toggle("open", opening);
		};
		const setCenterSeekVisible = (visible) => {
			[btnSeekBack, btnSeekFwd].forEach((button) => button.classList.toggle("visible", visible && touchMode));
		};
		const syncBigButton = () => {
			btnBig.innerHTML = vid.paused ? ICONS.bigPlay : ICONS.bigPause;
			btnBig.classList.toggle("visible", touchMode ? controlsShown || vid.paused : vid.paused && !hasStartedPlayback);
		};
		const hideControlsNow = () => {
			clearTimeout(controlsHideTimeout);
			controls.style.opacity = "0";
			setCenterSeekVisible(false);
			trackTooltip.classList.remove("visible");
			closeMenus();
			controlsShown = false;
			syncBigButton();
			if (document.fullscreenElement) pRoot.style.cursor = "none";
		};
		const scheduleControlsHide = () => {
			clearTimeout(controlsHideTimeout);
			controlsHideTimeout = setTimeout(() => {
				if (vid.paused) return;
				if (pointerOverControls) return;
				if (isAnyMenuOpen()) return;
				hideControlsNow();
			}, CONTROLS_HIDE_DELAY);
		};
		const showControls = ({ keepOpen = false } = {}) => {
			clearTimeout(controlsHideTimeout);
			controls.style.opacity = "1";
			setCenterSeekVisible(true);
			controlsShown = true;
			syncBigButton();
			pRoot.style.cursor = "";
			if (!keepOpen) scheduleControlsHide();
		};
		const centerSeek = (seconds) => {
			if (!isFinite(vid.duration)) return;
			vid.currentTime = Math.min(Math.max(vid.currentTime + seconds, 0), vid.duration);
			showSeekIndicator(seconds > 0 ? "forward" : "backward");
			renderProgress(vid.currentTime);
			showControls();
		};
		[[btnSeekBack, -10], [btnSeekFwd, 10]].forEach(([button, seconds]) => {
			button.addEventListener("click", (event) => {
				event.stopPropagation();
				centerSeek(seconds);
				button.classList.add("bump");
				setTimeout(() => button.classList.remove("bump"), 90);
			});
			button.addEventListener("dblclick", (event) => event.stopPropagation());
		});
		state.activePlayerUi = {
			vid,
			pRoot,
			menuWraps,
			btnFs,
			replacedNative: replaceNative,
			showSeekIndicator,
			showControls,
			renderProgress: (time) => renderProgress(time),
			applyVolume: (volume) => applyVolume(volume),
			togglePlay: () => togglePlay()
		};
		bindGlobalPlayerListeners();
		applyVolume(initialVolume, { persist: false });
		populateExternalMenu(extMenu, buildExternalTargets(streamUrl, makeVideoTitle(result)), () => extWrap.classList.remove("open"));
		extBtn.addEventListener("click", (event) => {
			event.stopPropagation();
			toggleMenu(extWrap);
		});
		qualBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			toggleMenu(qualWrap);
		});
		speedBtn.addEventListener("click", (event) => {
			event.stopPropagation();
			toggleMenu(speedWrap);
		});
		const speedOptions = PLAYBACK_RATES.map((rate) => {
			const option = buildMenuOption(`${rate}x`);
			option.addEventListener("click", (event) => {
				event.stopPropagation();
				vid.playbackRate = rate;
				closeMenus();
			});
			speedMenu.appendChild(option);
			return {
				rate,
				option
			};
		});
		const syncSpeedMenu = () => speedOptions.forEach(({ rate, option }) => option.classList.toggle("active", rate === vid.playbackRate));
		vid.addEventListener("ratechange", syncSpeedMenu);
		syncSpeedMenu();
		volumeSlider.addEventListener("input", () => {
			applyVolume(parseFloat(volumeSlider.value));
		});
		volumeButton.addEventListener("click", () => {
			if (vid.volume <= 0 || vid.muted) {
				applyVolume(previousVolumeBeforeMute > 0 ? previousVolumeBeforeMute : 1);
				return;
			}
			previousVolumeBeforeMute = vid.volume > 0 ? vid.volume : previousVolumeBeforeMute;
			applyVolume(0);
		});
		chatController.connectVideo(vid);
		const togglePlay = () => {
			if (vid.paused) vid.play();
			else vid.pause();
		};
		vid.addEventListener("pointerdown", (event) => {
			lastPointerType = event.pointerType || "mouse";
			if (lastPointerType !== "mouse") touchMode = true;
			controlsShownAtGestureStart = controlsShown;
		});
		let lastTapTime = 0;
		vid.addEventListener("click", () => {
			if (lastPointerType === "mouse") {
				togglePlay();
				return;
			}
			const now = Date.now();
			if (now - lastTapTime < 300) {
				lastTapTime = 0;
				btnFs.click();
				showControls();
				return;
			}
			lastTapTime = now;
			if (controlsShownAtGestureStart) hideControlsNow();
			else showControls();
		});
		btnPlay.addEventListener("click", togglePlay);
		btnBig.addEventListener("click", togglePlay);
		vid.addEventListener("play", () => {
			btnPlay.innerHTML = ICONS.pause;
			btnPlay.setAttribute("aria-label", "Pause");
			syncBigButton();
		});
		vid.addEventListener("pause", () => {
			btnPlay.innerHTML = ICONS.play;
			btnPlay.setAttribute("aria-label", "Play");
			syncBigButton();
			setLoadingState(false);
		});
		vid.addEventListener("playing", () => {
			hasStartedPlayback = true;
			setLoadingState(false);
			syncBigButton();
		});
		vid.addEventListener("waiting", () => {
			if (!vid.paused) setLoadingState(true);
		});
		vid.addEventListener("seeking", () => {
			if (hasStartedPlayback) setLoadingState(true);
		});
		vid.addEventListener("seeked", () => {
			if (!vid.paused && vid.readyState >= 3) setLoadingState(false);
		});
		vid.addEventListener("canplay", () => {
			if (!vid.paused && hasStartedPlayback) setLoadingState(false);
		});
		vid.addEventListener("stalled", () => {
			if (!vid.paused) setLoadingState(true);
		});
		vid.addEventListener("loadeddata", () => {
			if (vid.paused && !hasStartedPlayback) setLoadingState(false);
		});
		vid.addEventListener("ended", () => setLoadingState(false));
		let lastSave = 0;
		let lastPlaybackTime = vid.currentTime;
		vid.addEventListener("timeupdate", () => {
			if (vid.currentTime !== lastPlaybackTime && !vid.paused && !isBuffering()) setLoadingState(false);
			lastPlaybackTime = vid.currentTime;
			if (Date.now() - lastSave > 4e3) {
				saveResumeTime(resumeKey, vid.currentTime);
				saveWatchProgress(progressKey, vid.currentTime, vid.duration);
				lastSave = Date.now();
			}
			if (isFinite(vid.duration) && !isScrubbing) renderProgress(vid.currentTime);
		});
		vid.addEventListener("ended", () => {
			clearResumeTime(resumeKey);
			saveWatchProgress(progressKey, vid.duration, vid.duration);
		});
		const renderProgress = (time) => {
			if (!isFinite(vid.duration)) return;
			const percent = `${time / vid.duration * 100}%`;
			progressBar.style.width = percent;
			track.style.setProperty("--k-progress", percent);
			timeDisplay.textContent = `${formatClock(time)} / ${formatClock(vid.duration)}`;
		};
		const renderBuffered = () => {
			if (!isFinite(vid.duration) || vid.duration <= 0) return;
			let end = 0;
			for (let i = 0; i < vid.buffered.length; i++) if (vid.buffered.start(i) <= vid.currentTime + .5) end = Math.max(end, vid.buffered.end(i));
			bufferedBar.style.width = `${Math.min(end / vid.duration, 1) * 100}%`;
		};
		vid.addEventListener("progress", renderBuffered);
		vid.addEventListener("timeupdate", renderBuffered);
		let isScrubbing = false;
		let scrubPointerId = null;
		const ratioFromPointer = (clientX) => {
			const rect = track.getBoundingClientRect();
			return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		};
		const paintScrub = (clientX) => {
			if (!isFinite(vid.duration)) return;
			const ratio = ratioFromPointer(clientX);
			const rect = track.getBoundingClientRect();
			renderProgress(ratio * vid.duration);
			trackTooltipTime.textContent = formatClock(ratio * vid.duration);
			trackTooltip.style.left = `${ratio * rect.width}px`;
			trackTooltip.classList.add("visible");
			return ratio;
		};
		track.addEventListener("pointerdown", (event) => {
			if (!isFinite(vid.duration)) return;
			event.preventDefault();
			event.stopPropagation();
			isScrubbing = true;
			scrubPointerId = event.pointerId;
			track.classList.add("scrubbing");
			track.setPointerCapture(event.pointerId);
			paintScrub(event.clientX);
			showControls({ keepOpen: true });
		});
		track.addEventListener("pointermove", (event) => {
			if (!isScrubbing || event.pointerId !== scrubPointerId) return;
			event.preventDefault();
			paintScrub(event.clientX);
		});
		const endScrub = (event) => {
			if (!isScrubbing || event.pointerId !== scrubPointerId) return;
			isScrubbing = false;
			scrubPointerId = null;
			track.classList.remove("scrubbing");
			trackTooltip.classList.remove("visible");
			const ratio = ratioFromPointer(event.clientX);
			if (isFinite(vid.duration)) {
				const targetTime = ratio * vid.duration;
				vid.currentTime = targetTime;
				renderProgress(targetTime);
			}
			showControls();
		};
		track.addEventListener("pointerup", endScrub);
		track.addEventListener("pointercancel", endScrub);
		track.addEventListener("click", (event) => event.stopPropagation());
		track.addEventListener("mousemove", (e) => {
			if (isScrubbing || !isFinite(vid.duration)) return;
			const rect = track.getBoundingClientRect();
			const ratio = ratioFromPointer(e.clientX);
			trackTooltipTime.textContent = formatClock(ratio * vid.duration);
			trackTooltip.style.left = `${ratio * rect.width}px`;
			trackTooltip.classList.add("visible");
		});
		track.addEventListener("mouseenter", () => {
			if (isFinite(vid.duration)) trackTooltip.classList.add("visible");
		});
		track.addEventListener("mouseleave", () => {
			trackTooltip.classList.remove("visible");
		});
		pRoot.addEventListener("mouseenter", () => showControls());
		pRoot.addEventListener("mousemove", () => showControls());
		pRoot.addEventListener("mouseleave", () => {
			clearTimeout(controlsHideTimeout);
			closeMenus();
			trackTooltip.classList.remove("visible");
			pRoot.style.cursor = "";
			if (!vid.paused) controls.style.opacity = "0";
			if (!vid.paused) setCenterSeekVisible(false);
			if (!vid.paused) controlsShown = false;
		});
		controls.addEventListener("mouseenter", () => {
			pointerOverControls = true;
			showControls({ keepOpen: true });
		});
		controls.addEventListener("mouseleave", () => {
			pointerOverControls = false;
			scheduleControlsHide();
		});
		vid.addEventListener("play", () => scheduleControlsHide());
		vid.addEventListener("pause", () => showControls({ keepOpen: true }));
		document.addEventListener("fullscreenchange", () => {
			if (!pRoot.isConnected) return;
			const isFullscreen = document.fullscreenElement === pRoot;
			btnFs.innerHTML = isFullscreen ? ICONS.fullscreenExit : ICONS.fullscreen;
			const label = isFullscreen ? "Exit fullscreen" : "Fullscreen";
			btnFs.title = label;
			btnFs.setAttribute("aria-label", label);
			showControls();
		});
		btnFs.addEventListener("click", () => {
			if (!document.fullscreenElement) pRoot.requestFullscreen();
			else document.exitFullscreen();
		});
		vid.addEventListener("dblclick", () => {
			if (lastPointerType === "mouse") btnFs.click();
		});
		return {
			vid,
			btnBig,
			qualBtn,
			qualMenu,
			qualWrap,
			setLoadingState
		};
	}
	function qualityLabel$1(level) {
		const fps = Math.round(level.frameRate || 0);
		return `${level.height}p${fps > 30 ? fps : ""}`;
	}
	function setupPlayback({ vid, btnBig, qualBtn, qualMenu, qualWrap, setLoadingState }, { finalUrl, resumeKey, playerSettingsKey, savedPlayerSettings }) {
		if (hls_js.default.isSupported()) {
			const hls = new hls_js.default({
				debug: false,
				enableWorker: false,
				lowLatencyMode: true
			});
			state.activeHls = hls;
			hls.loadSource(finalUrl);
			hls.attachMedia(vid);
			hls.on(hls_js.default.Events.MANIFEST_LOADING, () => setLoadingState(true, { immediate: true }));
			hls.on(hls_js.default.Events.MANIFEST_PARSED, () => {
				setLoadingState(false);
				const setQuality = (level, label, optionRef = null, qualitySettings = null) => {
					hls.currentLevel = level;
					qualBtn.title = `Quality: ${label}`;
					[...qualMenu.querySelectorAll(".k-menu-option")].forEach((option) => option.classList.remove("active"));
					if (optionRef) optionRef.classList.add("active");
					if (qualitySettings) savePlayerSettings(playerSettingsKey, { quality: qualitySettings });
					qualWrap.classList.remove("open");
				};
				const addQualityItem = (level, label, qualitySettings, isActive = false) => {
					const item = buildMenuOption(label);
					if (isActive) item.classList.add("active");
					item.addEventListener("click", (e) => {
						e.stopPropagation();
						setQuality(level, label, item, qualitySettings);
					});
					qualMenu.appendChild(item);
					return item;
				};
				const qualityItems = [];
				const autoItem = addQualityItem(-1, "Auto", { mode: "auto" }, true);
				hls.levels.map((lvl, idx) => ({
					lvl,
					idx
				})).sort((a, b) => (b.lvl.height || 0) - (a.lvl.height || 0)).forEach(({ lvl, idx }) => {
					qualityItems.push({
						height: lvl.height,
						level: idx,
						label: qualityLabel$1(lvl),
						element: addQualityItem(idx, qualityLabel$1(lvl), {
							mode: "manual",
							height: lvl.height
						})
					});
				});
				const savedQuality = savedPlayerSettings.quality;
				if (savedQuality?.mode === "manual") {
					const matchedQuality = qualityItems.find((item) => item.height === savedQuality.height);
					if (matchedQuality) setQuality(matchedQuality.level, matchedQuality.label, matchedQuality.element, {
						mode: "manual",
						height: matchedQuality.height
					});
					else setQuality(-1, "Auto", autoItem, { mode: "auto" });
				} else setQuality(-1, "Auto", autoItem, { mode: "auto" });
				vid.play().catch(() => btnBig.classList.add("visible"));
			});
			const savedTime = parseFloat(readResumeTime(resumeKey));
			if (Number.isFinite(savedTime) && savedTime > 1) vid.addEventListener("loadedmetadata", () => {
				if (Number.isFinite(vid.duration)) vid.currentTime = Math.min(savedTime, vid.duration - 1);
				else vid.currentTime = savedTime;
			}, { once: true });
			hls.on(hls_js.default.Events.ERROR, (e, data) => {
				if (data.fatal) setLoadingState(false);
				if (data.fatal) {
					if (data.type === hls_js.default.ErrorTypes.NETWORK_ERROR) hls.startLoad();
					else if (data.type === hls_js.default.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
					else hls.destroy();
				}
			});
		} else if (vid.canPlayType("application/vnd.apple.mpegurl")) vid.src = finalUrl;
	}
	async function unlockVideo(triggerElement, options = {}) {
		const { explicitContainer = null, replaceNative = false } = options;
		if (state.isUnlocking) return;
		const container = explicitContainer || triggerElement?.closest(".relative.flex.flex-col") || null;
		if (!container || container.dataset.kickUnlockerProcessing) return;
		const { channelSlug, videoSlug, cacheKey } = getVodSlugs();
		const resumeKey = getResumeKey(channelSlug, videoSlug);
		const progressKey = getProgressKey(channelSlug, videoSlug);
		const playerSettingsKey = getPlayerSettingsKey(channelSlug, videoSlug);
		const savedPlayerSettings = loadPlayerSettings(playerSettingsKey);
		state.isUnlocking = true;
		try {
			let prefetched = null;
			if (replaceNative) {
				prefetched = await resolveStream(channelSlug, videoSlug);
				if (!prefetched) {
					state.customPlayerFailedKey = cacheKey;
					showToast("Kick Extended: stream not found, staying on Kick's player for this VOD.");
					return;
				}
			}
			stopNativePlayback(container);
			const containerRect = container.getBoundingClientRect();
			const fallbackMinHeight = Math.max(Math.round(containerRect.height || 0), Math.round((containerRect.width || 0) * 9 / 16), 360);
			container.style.width = "100%";
			container.style.minHeight = `${fallbackMinHeight}px`;
			if (containerRect.width > 0 && containerRect.height > 0) container.style.aspectRatio = `${containerRect.width} / ${containerRect.height}`;
			else container.style.aspectRatio = "16 / 9";
			if (state.activeHls) {
				state.activeHls.destroy();
				state.activeHls = null;
			}
			container.innerHTML = buildSplashMarkup(fallbackMinHeight);
			const result = prefetched?.result || await getVideoMetadata(channelSlug, videoSlug);
			if (!result) return;
			const streamUrl = prefetched?.streamUrl || await findStreamUrlFromMetadata(result);
			if (!streamUrl) {
				container.innerHTML = buildStreamNotFoundMarkup();
				return;
			}
			container.dataset.kickUnlockerProcessing = "true";
			container.innerHTML = "";
			container.style.background = "#000";
			const existingChat = document.querySelector(KICK_CHAT_SELECTOR);
			let chatRoot = null;
			if (existingChat) {
				existingChat.innerHTML = "";
				existingChat.style.display = "block";
				chatRoot = existingChat;
			} else {
				container.innerHTML = buildChatShellMarkup();
				chatRoot = container.querySelector("#unlocker-chat-area");
			}
			const startTime = new Date(result.video.start_time.replace(" ", "T") + (result.video.start_time.endsWith("Z") ? "" : "Z"));
			const chatController = new ChatController(result.channelId, startTime, chatRoot);
			chatController.init(null);
			state.activeChatController = chatController;
			const finalUrl = streamUrl + (streamUrl.includes("?") ? "&" : "?") + "kick_ts=" + Date.now();
			const videoParent = existingChat ? container : container.querySelector("#unlocker-video-area");
			videoParent.innerHTML = buildPlayerMarkup();
			const { vid, btnBig, qualBtn, qualMenu, qualWrap, setLoadingState } = createControls({
				videoParent,
				replaceNative,
				resumeKey,
				progressKey,
				playerSettingsKey,
				savedPlayerSettings,
				streamUrl,
				result,
				chatController
			});
			setupPlayback({
				vid,
				btnBig,
				qualBtn,
				qualMenu,
				qualWrap,
				setLoadingState
			}, {
				finalUrl,
				resumeKey,
				playerSettingsKey,
				savedPlayerSettings
			});
		} catch (e) {
			console.error(e);
			if (container) delete container.dataset.kickUnlockerProcessing;
		} finally {
			state.isUnlocking = false;
		}
	}
	var commands = [];
	var registeredIds = [];
	function render$1() {
		if (typeof GM_registerMenuCommand !== "function") return;
		if (registeredIds.length) {
			if (typeof GM_unregisterMenuCommand !== "function") return;
			registeredIds.forEach((id) => GM_unregisterMenuCommand(id));
		}
		registeredIds = commands.map((command) => GM_registerMenuCommand(command.label(), () => {
			command.run();
			render$1();
		}));
	}
	function addMenuCommand(command) {
		commands.push(command);
		render$1();
	}
	function ensureCustomPlayer() {
		if (!isVodPage() || state.isUnlocking) return;
		if (document.querySelector("[data-testid=\"video-subscriber-only\"]")) return;
		if (!isCustomPlayerEnabled()) {
			ensureNativeExternalButton();
			return;
		}
		const { channelSlug, videoSlug, cacheKey } = getVodSlugs();
		if (state.customPlayerFailedKey === cacheKey) {
			ensureNativeExternalButton();
			return;
		}
		if (state.prefetchedKey !== cacheKey) {
			state.prefetchedKey = cacheKey;
			resolveStream(channelSlug, videoSlug);
		}
		const container = findNativePlayerContainer();
		if (!container || container.dataset.kickUnlockerProcessing) return;
		if (!isNativePlayerVisible()) return;
		unlockVideo(null, {
			explicitContainer: container,
			replaceNative: true
		});
	}
	function registerCustomPlayerMenuCommand() {
		addMenuCommand({
			label: () => isCustomPlayerEnabled() ? "Custom player: on (click to turn off)" : "Custom player: off (click to turn on)",
			run: () => {
				const enabled = !isCustomPlayerEnabled();
				setCustomPlayerEnabled(enabled);
				if (enabled) {
					showToast("Kick Extended: custom player on.");
					ensureCustomPlayer();
					return;
				}
				showToast("Kick Extended: custom player off. Subscriber-only VODs still use it.");
				if (state.activePlayerUi?.replacedNative) window.location.reload();
			}
		});
	}
	function ensureNativeExternalButton() {
		const anchorButton = document.querySelector(CONTROL_ANCHOR_SELECTOR);
		if (!anchorButton || !anchorButton.parentElement) return;
		if (anchorButton.parentElement.querySelector("#k-native-ext-wrap")) return;
		const wrap = document.createElement("div");
		wrap.id = "k-native-ext-wrap";
		wrap.className = "k-ext-wrap";
		const button = document.createElement("button");
		button.type = "button";
		button.title = "Open in external player";
		button.setAttribute("aria-label", "Open in external player");
		button.className = anchorButton.className;
		button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block shrink-0" xmlns="http://www.w3.org/2000/svg"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;
		const menu = document.createElement("div");
		menu.className = "k-ext-menu";
		const closeMenu = () => wrap.classList.remove("open");
		button.addEventListener("click", async (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (wrap.classList.contains("open")) {
				closeMenu();
				return;
			}
			const { channelSlug, videoSlug, cacheKey } = getVodSlugs();
			wrap.classList.add("open");
			if (state.nativeExternalCache?.key !== cacheKey) {
				menu.innerHTML = `<div class="k-ext-heading">Resolving stream URL…</div>`;
				const resolved = await resolveStream(channelSlug, videoSlug);
				if (!resolved) {
					menu.innerHTML = `<div class="k-ext-heading">Stream not found</div>`;
					return;
				}
				state.nativeExternalCache = {
					key: cacheKey,
					...resolved
				};
			}
			populateExternalMenu(menu, buildExternalTargets(state.nativeExternalCache.streamUrl, makeVideoTitle(state.nativeExternalCache.result)), closeMenu);
		});
		document.addEventListener("click", (event) => {
			if (wrap.isConnected && !wrap.contains(event.target)) closeMenu();
		});
		wrap.appendChild(button);
		wrap.appendChild(menu);
		anchorButton.parentElement.insertBefore(wrap, anchorButton);
	}
	var RETRYABLE_STATUS = new Set([
		408,
		425,
		429,
		500,
		502,
		503,
		504
	]);
	function tagged(name, message) {
		const error = new Error(message);
		error.name = name;
		return error;
	}
	function sleep(ms, signal) {
		return new Promise((resolve, reject) => {
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
	async function fetchSegmentWithRetry(segment, signal, throttle) {
		let lastError = null;
		for (let attempt = 0; attempt < 3; attempt++) {
			if (attempt > 0) await sleep(1e3 * 2 ** (attempt - 1), signal);
			try {
				const response = await fetch(segment.url, {
					signal,
					credentials: "omit",
					cache: "no-store",
					headers: segment.range ? { Range: `bytes=${segment.range.start}-${segment.range.end}` } : void 0
				});
				if (!response.ok) {
					response.body?.cancel();
					if (response.status === 429) {
						const retryAfter = parseInt(response.headers.get("Retry-After") || "", 10);
						throttle.until = Date.now() + (Number.isFinite(retryAfter) ? retryAfter * 1e3 : 5e3);
						lastError = tagged("HttpError", "HTTP 429");
						continue;
					}
					if (RETRYABLE_STATUS.has(response.status)) {
						lastError = tagged("HttpError", `HTTP ${response.status}`);
						continue;
					}
					throw tagged("FatalSegmentError", `HTTP ${response.status}`);
				}
				return new Uint8Array(await response.arrayBuffer());
			} catch (error) {
				if (error.name === "AbortError") throw error;
				if (error.name === "FatalSegmentError") throw error;
				lastError = error;
			}
		}
		throw tagged("ExhaustedError", `${segment.url}: ${lastError ? lastError.message : "unknown"}`);
	}
	function makeGate() {
		let waiters = [];
		return {
			wait: () => new Promise((resolve) => waiters.push(resolve)),
			wake: () => {
				const pending = waiters;
				waiters = [];
				for (const resolve of pending) resolve();
			}
		};
	}
	var FAILED = Symbol("failed-segment");
	async function runPipeline(active, segments) {
		const { controller, writable, progress } = active;
		const signal = controller.signal;
		const gate = makeGate();
		const done = new Map();
		let nextToFetch = 0;
		let nextToWrite = 0;
		let consecutiveFailures = 0;
		async function worker() {
			for (;;) {
				if (signal.aborted || active.stopReason) return;
				if (nextToFetch >= segments.length) return;
				if (nextToFetch >= nextToWrite + 16) {
					await gate.wait();
					continue;
				}
				const pause = progress.throttle.until - Date.now();
				if (pause > 0) {
					await sleep(pause, signal);
					continue;
				}
				const index = nextToFetch++;
				let value;
				try {
					value = await fetchSegmentWithRetry(segments[index], signal, progress.throttle);
				} catch (error) {
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
				if (value === void 0) {
					await gate.wait();
					continue;
				}
				done.delete(nextToWrite);
				if (value === FAILED) {
					progress.gaps.push(nextToWrite);
					consecutiveFailures++;
					if (consecutiveFailures >= 5) {
						active.stopReason = "segments-unavailable";
						gate.wake();
						return;
					}
				} else {
					try {
						await writable.write(value);
					} catch (error) {
						active.stopReason = error && error.name === "QuotaExceededError" ? "out-of-space" : "write-failed";
						active.stopError = error;
						gate.wake();
						return;
					}
					progress.bytesWritten += value.byteLength;
					consecutiveFailures = 0;
				}
				nextToWrite++;
				progress.segmentsWritten++;
				gate.wake();
			}
		}
		const workers = [];
		for (let i = 0; i < 8; i++) workers.push(worker());
		await Promise.allSettled([...workers, writer()]);
	}
	function computeSnapshot(active, ewma) {
		const p = active.progress;
		const percent = p.totalSegments ? p.segmentsWritten / p.totalSegments * 100 : 0;
		const estimatedTotalBytes = p.segmentsWritten >= 5 ? p.bytesWritten / p.segmentsWritten * p.totalSegments : p.estimatedTotalBytes;
		const remaining = Math.max(0, estimatedTotalBytes - p.bytesWritten);
		return {
			status: active.status,
			fileName: active.fileName,
			vodTitle: active.vodTitle,
			bytesWritten: p.bytesWritten,
			estimatedTotalBytes,
			percent,
			bytesPerSecond: ewma,
			etaSeconds: ewma > 0 ? remaining / ewma : null,
			segmentsWritten: p.segmentsWritten,
			totalSegments: p.totalSegments,
			gapCount: p.gaps.length,
			stopReason: active.stopReason
		};
	}
	function emit(active, snapshot) {
		active.snapshot = snapshot;
		for (const subscriber of active.subscribers) try {
			subscriber(snapshot);
		} catch {}
	}
	function subscribeToDownload(active, fn) {
		if (!active) return () => {};
		active.subscribers.add(fn);
		if (active.snapshot) fn(active.snapshot);
		return () => active.subscribers.delete(fn);
	}
	async function finalize(active, status) {
		clearInterval(active.progressTimer);
		window.removeEventListener("beforeunload", active.onBeforeUnload);
		try {
			if (active.discard) await active.writable.abort();
			else await active.writable.close();
		} catch {}
		active.status = status;
		emit(active, computeSnapshot(active, 0));
		state.activeDownload = null;
	}
	function cancelDownload(discard = false) {
		const active = state.activeDownload;
		if (!active) return Promise.resolve();
		if (active.finalizing) return active.finalizing;
		active.status = "cancelling";
		active.discard = discard;
		active.controller.abort();
		emit(active, computeSnapshot(active, 0));
		return active.finalizing || Promise.resolve();
	}
	async function startDownload(options) {
		if (state.activeDownload) return state.activeDownload;
		const { fileHandle, fileName, vodTitle, segments, initSegment, estimatedTotalBytes } = options;
		const writable = await fileHandle.createWritable();
		const controller = new AbortController();
		const active = {
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
			onBeforeUnload: (event) => {
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
				throttle: { until: 0 }
			}
		};
		state.activeDownload = active;
		window.addEventListener("beforeunload", active.onBeforeUnload);
		let lastBytes = 0;
		let lastTime = performance.now();
		let ewma = 0;
		active.progressTimer = setInterval(() => {
			const now = performance.now();
			const elapsed = (now - lastTime) / 1e3;
			if (elapsed > 0) {
				const instant = (active.progress.bytesWritten - lastBytes) / elapsed;
				ewma = ewma === 0 ? instant : ewma * .8 + instant * .2;
				lastBytes = active.progress.bytesWritten;
				lastTime = now;
			}
			emit(active, computeSnapshot(active, ewma));
		}, 250);
		const run = async () => {
			try {
				if (initSegment) {
					const head = await fetchSegmentWithRetry(initSegment, controller.signal, active.progress.throttle);
					await writable.write(head);
					active.progress.bytesWritten += head.byteLength;
				}
				await runPipeline(active, segments);
			} catch {}
			let status = "done";
			if (controller.signal.aborted) status = "cancelled";
			else if (active.stopReason) status = "failed";
			active.finalizing = finalize(active, status);
			return active.finalizing;
		};
		active.runner = run();
		return active;
	}
	function formatBytes(bytes) {
		if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
		const gb = bytes / 1024 ** 3;
		if (gb >= 1) return `${gb.toFixed(2)} GB`;
		return `${Math.round(bytes / 1024 ** 2)} MB`;
	}
	function describe(snapshot) {
		if (snapshot.status === "running") {
			const rate = snapshot.bytesPerSecond ? ` · ${(snapshot.bytesPerSecond / 1024 ** 2).toFixed(1)} MB/s` : "";
			const eta = snapshot.etaSeconds === null ? " · --:--" : ` · ${formatTime(snapshot.etaSeconds)} left`;
			return `${formatBytes(snapshot.bytesWritten)} of ~${formatBytes(snapshot.estimatedTotalBytes)}${rate}${eta}`;
		}
		if (snapshot.status === "cancelling") return "Finishing the current segment…";
		const written = `${snapshot.segmentsWritten} of ${snapshot.totalSegments} segments`;
		const gaps = snapshot.gapCount ? ` · ${snapshot.gapCount} gap${snapshot.gapCount === 1 ? "" : "s"} (~${Math.round(snapshot.gapCount * 10)} s missing)` : "";
		if (snapshot.status === "cancelled") return `Cancelled — kept ${written}${gaps}`;
		if (snapshot.status === "failed") return `Stopped (${snapshot.stopReason === "out-of-space" ? "ran out of disk space" : snapshot.stopReason === "segments-unavailable" ? "segments stopped responding" : "write failed"}) — kept ${written}${gaps}`;
		return `Done — ${written}${gaps}`;
	}
	function showDownloadPanel(active) {
		document.getElementById(DOWNLOAD_PANEL_ID)?.remove();
		const panel = document.createElement("div");
		panel.id = DOWNLOAD_PANEL_ID;
		const title = document.createElement("div");
		title.className = "k-dl-panel-title";
		const bar = document.createElement("div");
		bar.className = "k-dl-bar";
		const fill = document.createElement("div");
		fill.className = "k-dl-bar-fill";
		bar.appendChild(fill);
		const detail = document.createElement("div");
		detail.className = "k-dl-panel-detail";
		const action = document.createElement("button");
		action.type = "button";
		action.className = "k-dl-panel-action";
		panel.append(title, bar, detail, action);
		document.body.appendChild(panel);
		let unsubscribe = null;
		const dismiss = () => {
			if (unsubscribe) unsubscribe();
			panel.remove();
		};
		const render = (snapshot) => {
			title.textContent = snapshot.vodTitle || snapshot.fileName;
			fill.style.width = `${Math.min(100, snapshot.percent).toFixed(1)}%`;
			detail.textContent = describe(snapshot);
			const finished = snapshot.status === "done" || snapshot.status === "cancelled" || snapshot.status === "failed";
			panel.dataset.state = snapshot.status;
			action.textContent = finished ? "Close" : "Cancel";
			action.disabled = snapshot.status === "cancelling";
		};
		action.addEventListener("click", () => {
			if ([
				"done",
				"cancelled",
				"failed"
			].includes(panel.dataset.state || "")) dismiss();
			else cancelDownload();
		});
		unsubscribe = subscribeToDownload(active, render);
		return panel;
	}
	function buildDownloadUrl(videoUrl) {
		return `https://kick-video.download/?download=${encodeURIComponent(videoUrl)}`;
	}
	var ILLEGAL = /[\\/:*?"<>|]/g;
	function clean(value, limit) {
		return String(value || "").replace(ILLEGAL, "").replace(/\s+/g, " ").trim().slice(0, limit).trim();
	}
	function makeDownloadFileName(parts) {
		const resolution = clean(parts.resolution, 12);
		const title = clean(parts.title, 80) || "kick-vod";
		const channel = clean(parts.channel, 40);
		let name = title;
		if (channel) name += ` - ${channel}`;
		if (resolution) name = `(${resolution}) ${name}`;
		return name.replace(/[. ]+$/, "") || "kick-vod";
	}
	function getPickerHost() {
		if (typeof window.showSaveFilePicker === "function") return window;
		const unsafe = typeof unsafeWindow !== "undefined" ? unsafeWindow : null;
		if (unsafe && typeof unsafe.showSaveFilePicker === "function") return unsafe;
		return null;
	}
	function canStreamToDisk() {
		return getPickerHost() !== null;
	}
	function parseAttributes(line) {
		const attributes = {};
		const pattern = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
		let match;
		while ((match = pattern.exec(line)) !== null) attributes[match[1]] = match[2].replace(/^"|"$/g, "");
		return attributes;
	}
	function parseMasterPlaylist(text, playlistUrl) {
		const variants = [];
		let pending = null;
		for (const raw of text.split(/\r?\n/)) {
			const line = raw.trim();
			if (!line) continue;
			if (line.startsWith("#EXT-X-STREAM-INF:")) {
				const attributes = parseAttributes(line);
				const [width, height] = String(attributes.RESOLUTION || "x").split("x");
				pending = {
					bandwidth: parseInt(attributes.BANDWIDTH, 10) || 0,
					width: parseInt(width, 10) || 0,
					height: parseInt(height, 10) || 0,
					frameRate: parseFloat(attributes["FRAME-RATE"]) || 0,
					codecs: attributes.CODECS || "",
					name: attributes.NAME || attributes.VIDEO || ""
				};
			} else if (!line.startsWith("#") && pending) {
				pending.url = new URL(line, playlistUrl).href;
				variants.push(pending);
				pending = null;
			}
		}
		return variants.sort((a, b) => b.bandwidth - a.bandwidth);
	}
	function parseMediaPlaylist(text, playlistUrl) {
		const segments = [];
		let duration = 0;
		let initSegment = null;
		let pendingDuration = 0;
		let pendingRange = null;
		let rangeCursor = 0;
		for (const raw of text.split(/\r?\n/)) {
			const line = raw.trim();
			if (!line) continue;
			if (line.startsWith("#EXTINF:")) pendingDuration = parseFloat(line.slice(8)) || 0;
			else if (line.startsWith("#EXT-X-BYTERANGE:")) {
				const [length, offset] = line.slice(17).split("@");
				const start = offset !== void 0 ? parseInt(offset, 10) : rangeCursor;
				rangeCursor = start + parseInt(length, 10);
				pendingRange = {
					start,
					end: rangeCursor - 1
				};
			} else if (line.startsWith("#EXT-X-MAP:")) {
				const attributes = parseAttributes(line);
				const [length, offset] = String(attributes.BYTERANGE || "").split("@");
				const start = parseInt(offset, 10) || 0;
				initSegment = {
					url: new URL(attributes.URI, playlistUrl).href,
					range: length ? {
						start,
						end: start + parseInt(length, 10) - 1
					} : null
				};
			} else if (line.startsWith("#EXT-X-KEY:")) {
				if (parseAttributes(line).METHOD !== "NONE") throw new Error("Encrypted playlists are not supported");
			} else if (!line.startsWith("#")) {
				segments.push({
					url: new URL(line, playlistUrl).href,
					duration: pendingDuration,
					range: pendingRange
				});
				duration += pendingDuration;
				pendingDuration = 0;
				pendingRange = null;
			}
		}
		return {
			segments,
			duration,
			initSegment
		};
	}
	function qualityLabel(variant) {
		return variant.name || `${variant.height}p`;
	}
	function formatSize(bytes) {
		const gb = bytes / 1024 ** 3;
		return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
	}
	async function fetchText(url) {
		const response = await fetch(url, {
			credentials: "omit",
			cache: "no-store"
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return response.text();
	}
	function openDownloadDialog(options = {}) {
		const pathname = options.pathname || window.location.pathname;
		const pageUrl = options.pageUrl || window.location.href;
		document.getElementById(DOWNLOAD_DIALOG_ID)?.remove();
		const backdrop = document.createElement("div");
		backdrop.id = DOWNLOAD_DIALOG_ID;
		const dialog = document.createElement("div");
		dialog.className = "k-dl-dialog";
		backdrop.appendChild(dialog);
		const close = () => {
			backdrop.remove();
			document.removeEventListener("keydown", onKey);
		};
		const onKey = (event) => {
			if (event.key === "Escape") close();
		};
		document.addEventListener("keydown", onKey);
		backdrop.addEventListener("click", (event) => {
			if (event.target === backdrop) close();
		});
		const heading = document.createElement("div");
		heading.className = "k-dl-heading";
		heading.textContent = "Download VOD";
		const body = document.createElement("div");
		body.className = "k-dl-body";
		body.textContent = "Resolving stream…";
		const footer = document.createElement("div");
		footer.className = "k-dl-footer";
		const handoff = document.createElement("button");
		handoff.type = "button";
		handoff.className = "k-dl-secondary";
		handoff.textContent = "Use kick-video.download";
		handoff.addEventListener("click", () => {
			window.open(buildDownloadUrl(pageUrl), "_blank", "noopener");
			close();
		});
		footer.appendChild(handoff);
		dialog.append(heading, body, footer);
		document.body.appendChild(backdrop);
		load(body, footer, pathname, close);
		return backdrop;
	}
	async function load(body, footer, pathname, close) {
		const { channelSlug, videoSlug, cacheKey } = getVodSlugs(pathname);
		if (!channelSlug || !videoSlug) {
			body.textContent = "This does not look like a VOD page.";
			return;
		}
		try {
			if (state.nativeExternalCache?.key !== cacheKey) {
				const resolved = await resolveStream(channelSlug, videoSlug);
				if (!resolved) {
					body.textContent = "Stream not found.";
					return;
				}
				state.nativeExternalCache = {
					key: cacheKey,
					...resolved
				};
			}
			const cache = state.nativeExternalCache;
			const variants = parseMasterPlaylist(await fetchText(cache.streamUrl), cache.streamUrl);
			if (!variants.length) {
				body.textContent = "No qualities found in the playlist.";
				return;
			}
			const duration = parseMediaPlaylist(await fetchText(variants[0].url), variants[0].url).duration;
			render(body, footer, variants, duration, cache, close);
		} catch (error) {
			body.textContent = `Could not read the playlist: ${error.message}`;
		}
	}
	function render(body, footer, variants, duration, cache, close) {
		body.textContent = "";
		const available = canStreamToDisk();
		if (!available) {
			const note = document.createElement("div");
			note.className = "k-dl-note";
			note.textContent = "This browser cannot save large files directly to disk (the File System Access API is Chromium-only), so the built-in downloader is unavailable here. The link below still works.";
			body.appendChild(note);
		}
		const list = document.createElement("div");
		list.className = "k-dl-qualities";
		let selected = variants.find((v) => v.height === 720) || variants[Math.min(1, variants.length - 1)];
		for (const variant of variants) {
			const option = document.createElement("button");
			option.type = "button";
			option.className = "k-dl-quality";
			option.disabled = !available;
			option.textContent = `${qualityLabel(variant)} · ${(variant.bandwidth / 1e6).toFixed(1)} Mbps · ~${formatSize(variant.bandwidth / 8 * duration)}`;
			option.addEventListener("click", () => {
				selected = variant;
				for (const el of list.children) el.classList.remove("active");
				option.classList.add("active");
			});
			if (variant === selected) option.classList.add("active");
			list.appendChild(option);
		}
		body.appendChild(list);
		if (!available) return;
		const start = document.createElement("button");
		start.type = "button";
		start.className = "k-dl-primary";
		start.textContent = "Download";
		start.addEventListener("click", async () => {
			const host = getPickerHost();
			if (!host) return;
			const title = makeVideoTitle(cache.result);
			const fileName = `${makeDownloadFileName({
				resolution: qualityLabel(selected),
				title,
				channel: cache.result?.channelName || cache.result?.channelSlug
			})}.ts`;
			let handle;
			try {
				handle = await host.showSaveFilePicker({
					suggestedName: fileName,
					types: [{
						description: "MPEG transport stream",
						accept: { "video/mp2t": [".ts"] }
					}]
				});
			} catch {
				return;
			}
			start.disabled = true;
			start.textContent = "Reading playlist…";
			try {
				const media = parseMediaPlaylist(await fetchText(selected.url), selected.url);
				close();
				showDownloadPanel(await startDownload({
					fileHandle: handle,
					fileName,
					vodTitle: title,
					segments: media.segments,
					initSegment: media.initSegment,
					estimatedTotalBytes: selected.bandwidth / 8 * media.duration
				}));
			} catch (error) {
				start.disabled = false;
				start.textContent = "Download";
				body.appendChild(Object.assign(document.createElement("div"), {
					className: "k-dl-note",
					textContent: `Could not start: ${error.message}`
				}));
			}
		});
		footer.insertBefore(start, footer.firstChild);
	}
	function createDownloadIcon() {
		const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		icon.setAttribute("viewBox", "0 0 24 24");
		icon.setAttribute("width", "1em");
		icon.setAttribute("height", "1em");
		icon.innerHTML = "<path d=\"M0 0h24v24H0z\" fill=\"none\"/><path fill=\"currentColor\" d=\"M16.59 9H15V4c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v5H7.41c-.89 0-1.34 1.08-.71 1.71l4.59 4.59c.39.39 1.02.39 1.41 0l4.59-4.59c.63-.63.19-1.71-.7-1.71M5 19c0 .55.45 1 1 1h12c.55 0 1-.45 1-1s-.45-1-1-1H6c-.55 0-1 .45-1 1\"/>";
		icon.style.flexShrink = "0";
		return icon;
	}
	function findSubscribeButton() {
		const spans = document.querySelectorAll("button span");
		for (const span of spans) if (span.textContent.trim() === "Subscribe") return span.closest("button");
		return null;
	}
	function createDownloadButton(referenceButton) {
		const button = document.createElement("button");
		button.id = DOWNLOAD_BUTTON_ID;
		button.className = referenceButton.className;
		button.style.marginLeft = "8px";
		button.appendChild(createDownloadIcon());
		const label = document.createElement("span");
		label.className = "k-dl-btn-label";
		label.textContent = "Download";
		label.style.marginLeft = "6px";
		button.appendChild(label);
		button.style.display = "inline-flex";
		button.style.alignItems = "center";
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			openDownloadDialog();
		});
		return button;
	}
	function injectDownloadButton() {
		if (!isVodPage()) {
			document.getElementById(DOWNLOAD_BUTTON_ID)?.remove();
			return;
		}
		const existing = document.getElementById(DOWNLOAD_BUTTON_ID);
		if (existing) {
			syncDownloadButtonState(existing);
			return;
		}
		const subscribeButton = findSubscribeButton();
		if (!subscribeButton) return;
		const downloadButton = createDownloadButton(subscribeButton);
		subscribeButton.insertAdjacentElement("afterend", downloadButton);
	}
	function syncDownloadButtonState(button) {
		const next = state.activeDownload ? "busy" : "idle";
		if (button.dataset.dlState === next) return;
		button.dataset.dlState = next;
		const busy = next === "busy";
		button.disabled = busy;
		button.style.opacity = busy ? "0.6" : "";
		const label = button.querySelector(".k-dl-btn-label");
		if (label) label.textContent = busy ? "Downloading…" : "Download";
	}
	function injectThumbnailButtons() {
		const anchors = document.querySelectorAll("a[href*=\"/videos/\"]");
		for (const anchor of anchors) {
			if (anchor.dataset["kDlInjected"]) continue;
			const href = anchor.getAttribute("href");
			if (!href || !VOD_PATH_REGEX.test(href)) continue;
			if (!anchor.querySelector("img[data-thumbnail], img")) continue;
			anchor.dataset[THUMB_INJECTED_FLAG] = "true";
			const button = document.createElement("button");
			button.className = THUMB_DOWNLOAD_BUTTON_CLASS;
			button.title = "Download video";
			button.appendChild(createDownloadIcon());
			const videoUrl = new URL(href, window.location.origin).href;
			button.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				const target = new URL(videoUrl);
				openDownloadDialog({
					pathname: target.pathname,
					pageUrl: target.href
				});
			});
			anchor.appendChild(button);
		}
	}
	var DURATION_TEXT_REGEX = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/;
	function readDurationBadge(anchor) {
		for (const el of anchor.querySelectorAll("div, span")) {
			if (el.childElementCount) continue;
			const match = DURATION_TEXT_REGEX.exec(el.textContent?.trim() || "");
			if (match) return Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
		}
		return null;
	}
	function getWatchedFraction(anchor, href) {
		const { channelSlug, videoSlug } = getVodSlugs(href);
		let time;
		let duration;
		const progress = readWatchProgress(getProgressKey(channelSlug, videoSlug));
		if (progress) ({time, duration} = progress);
		else {
			time = parseFloat(readResumeTime(getResumeKey(channelSlug, videoSlug)));
			duration = readDurationBadge(anchor);
		}
		if (!Number.isFinite(time) || time <= 1 || !duration) return null;
		return Math.min(time / duration, 1);
	}
	function renderBar(anchor, href) {
		const fraction = getWatchedFraction(anchor, href);
		let bar = anchor.querySelector(`:scope > .${THUMB_PROGRESS_CLASS}`);
		if (fraction === null) {
			bar?.remove();
			return;
		}
		if (!bar) {
			bar = document.createElement("div");
			bar.className = THUMB_PROGRESS_CLASS;
			bar.appendChild(document.createElement("div"));
			anchor.appendChild(bar);
		}
		bar.firstElementChild.style.width = `${fraction * 100}%`;
	}
	function findVodThumbnails(root) {
		return [...root.querySelectorAll("a[href*=\"/videos/\"]")].filter((anchor) => {
			const href = anchor.getAttribute("href");
			return href && VOD_PATH_REGEX.test(href) && anchor.querySelector("img");
		});
	}
	function injectThumbnailProgress(refresh = false) {
		for (const anchor of findVodThumbnails(document)) {
			const href = anchor.getAttribute("href");
			if (!refresh && anchor.dataset["kProgressFor"] === href) continue;
			anchor.dataset[THUMB_PROGRESS_FLAG] = href;
			renderBar(anchor, href);
		}
	}
	function findCardThumbnail(trigger) {
		for (let node = trigger.parentElement; node; node = node.parentElement) {
			const thumbnails = findVodThumbnails(node);
			if (!thumbnails.length) continue;
			return new Set(thumbnails.map((a) => a.getAttribute("href"))).size === 1 ? thumbnails[0] : null;
		}
		return null;
	}
	var HISTORY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block shrink-0"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`;
	function createMenuItem(menu, href) {
		const item = document.createElement("button");
		item.type = "button";
		item.setAttribute("role", "menuitem");
		item.tabIndex = -1;
		item.className = `${menu.querySelector("[role=\"menuitem\"]")?.className || ""} ${PROGRESS_MENU_ITEM_CLASS}`;
		item.innerHTML = `${HISTORY_ICON}<span>Remove watch progress</span>`;
		item.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			const { channelSlug, videoSlug } = getVodSlugs(href);
			clearWatchProgress(getProgressKey(channelSlug, videoSlug));
			clearResumeTime(getResumeKey(channelSlug, videoSlug));
			injectThumbnailProgress(true);
			document.dispatchEvent(new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true
			}));
		});
		return item;
	}
	function injectProgressMenuItem() {
		for (const menu of document.querySelectorAll(KICK_MENU_SELECTOR)) {
			if (menu.dataset["kProgressMenu"]) continue;
			menu.dataset[PROGRESS_MENU_FLAG] = "true";
			const trigger = document.getElementById(menu.getAttribute("aria-labelledby"));
			const thumbnail = trigger && findCardThumbnail(trigger);
			if (!thumbnail) continue;
			const href = thumbnail.getAttribute("href");
			if (getWatchedFraction(thumbnail, href) === null) continue;
			menu.appendChild(createMenuItem(menu, href));
		}
	}
	function installThumbnailProgressRefresh() {
		window.addEventListener("storage", (event) => {
			if (event.key === null || event.key.startsWith("kick_extended_")) injectThumbnailProgress(true);
		});
		window.addEventListener("pageshow", (event) => {
			if (event.persisted) injectThumbnailProgress(true);
		});
	}
	var SAVE_INTERVAL_MS = 4e3;
	var tracked = new WeakSet();
	function currentProgressKey() {
		if (!isVodPage()) return null;
		const { channelSlug, videoSlug } = getVodSlugs();
		return getProgressKey(channelSlug, videoSlug);
	}
	function customPlayerOwnsProgress() {
		if (state.activePlayerUi || state.isUnlocking) return true;
		return isCustomPlayerEnabled() && state.customPlayerFailedKey !== getVodSlugs().cacheKey;
	}
	function trackNativeProgress() {
		if (!isVodPage()) return;
		const video = document.querySelector(NATIVE_VIDEO_SELECTOR);
		if (!video || tracked.has(video)) return;
		tracked.add(video);
		let progressKey = currentProgressKey();
		let lastSave = Date.now();
		video.addEventListener("loadstart", () => {
			progressKey = currentProgressKey();
			lastSave = Date.now();
		});
		const save = (time) => {
			if (!progressKey || progressKey !== currentProgressKey()) return;
			if (customPlayerOwnsProgress()) return;
			saveWatchProgress(progressKey, time, video.duration);
		};
		video.addEventListener("timeupdate", () => {
			if (video.paused || Date.now() - lastSave < SAVE_INTERVAL_MS) return;
			lastSave = Date.now();
			save(video.currentTime);
		});
		video.addEventListener("ended", () => save(video.duration));
	}
	function hardNavigationTarget(event) {
		if (event.defaultPrevented || event.button !== 0) return null;
		if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return null;
		const control = event.target?.closest?.("a[href], button");
		if (!control || control.tagName !== "A") return null;
		const anchor = control;
		if (anchor.hasAttribute("download")) return null;
		if (anchor.target && anchor.target !== "_self") return null;
		const url = new URL(anchor.href, window.location.href);
		if (url.origin !== window.location.origin) return null;
		if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
		return url.href;
	}
	function installSpaBlocker() {
		window.addEventListener("click", (event) => {
			if (!getSpaDisabled()) return;
			const href = hardNavigationTarget(event);
			if (!href) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			window.location.assign(href);
		}, true);
	}
	function interceptPushState(url) {
		if (!getSpaDisabled() || url == null) return false;
		const next = new URL(String(url), window.location.href);
		if (next.pathname === window.location.pathname) return false;
		window.location.assign(next.href);
		return true;
	}
	function registerSpaMenuCommand() {
		addMenuCommand({
			label: () => getSpaDisabled() ? "SPA navigation: off (click to turn on)" : "SPA navigation: on (click to turn off)",
			run: () => {
				const disabled = !getSpaDisabled();
				setSpaDisabled(disabled);
				showToast(disabled ? "Kick Extended: SPA navigation off. Links now load a fresh page." : "Kick Extended: SPA navigation on.");
			}
		});
	}
	console.log(`Kick Extended: userscript loaded (v${GM_info.script.version}), stream-to-disk ${canStreamToDisk() ? "available" : "unavailable"}`);
	GM_addStyle(styles_default);
	function destroyCustomPlayer() {
		if (state.activeHls) {
			try {
				state.activeHls.destroy();
			} catch (e) {}
			state.activeHls = null;
		}
		if (state.activeChatController) {
			try {
				state.activeChatController.stop();
			} catch (e) {}
			state.activeChatController = null;
		}
		const customVideo = state.activePlayerUi?.vid || document.querySelector("#k-video");
		if (customVideo) {
			try {
				customVideo.pause();
				customVideo.removeAttribute("src");
				customVideo.srcObject = null;
				customVideo.load();
			} catch (e) {}
			customVideo.remove();
		}
		document.querySelectorAll("#k-player").forEach((el) => el.remove());
		document.querySelector("#k-toast")?.remove();
		document.querySelector("#k-copy-url-btn")?.remove();
		document.querySelectorAll("[data-kick-unlocker-processing]").forEach((el) => delete el.dataset.kickUnlockerProcessing);
		releaseNativePlayback();
		state.nativeExternalCache = null;
		state.activePlayerUi = null;
		state.isUnlocking = false;
	}
	var lastHref = window.location.href;
	function handleLocationChange() {
		if (window.location.href === lastHref) return;
		lastHref = window.location.href;
		destroyCustomPlayer();
		state.pendingStream = null;
		state.prefetchedKey = null;
		state.customPlayerFailedKey = null;
	}
	function runDownloadInjections() {
		injectDownloadButton();
		injectThumbnailButtons();
	}
	var navigationCallbacks = [
		handleLocationChange,
		() => setTimeout(runDownloadInjections, 100),
		() => setTimeout(() => injectThumbnailProgress(true), 100)
	];
	function onNavigate() {
		navigationCallbacks.forEach((callback) => callback());
	}
	["pushState", "replaceState"].forEach((method) => {
		const original = history[method];
		history[method] = function(...args) {
			if (method === "pushState" && interceptPushState(args[2])) return;
			const returned = original.apply(this, args);
			onNavigate();
			return returned;
		};
	});
	window.addEventListener("popstate", onNavigate);
	window.addEventListener("hashchange", handleLocationChange);
	window.addEventListener("pagehide", destroyCustomPlayer);
	installNativePlaybackGuard();
	installSpaBlocker();
	registerCustomPlayerMenuCommand();
	registerSpaMenuCommand();
	installThumbnailProgressRefresh();
	new MutationObserver(() => {
		handleLocationChange();
		if (state.activePlayerUi?.vid && !state.activePlayerUi.vid.isConnected) destroyCustomPlayer();
		const subscriberOverlay = document.querySelector(SUBSCRIBER_ONLY_SELECTOR);
		ensureCopyUrlButton();
		if (subscriberOverlay) {
			const outerContainer = subscriberOverlay.closest(SUBSCRIBER_OVERLAY_CONTAINER_SELECTOR);
			if (outerContainer && !outerContainer.dataset.kickUnlockerProcessing && !state.isUnlocking) unlockVideo(subscriberOverlay);
		} else ensureCustomPlayer();
		runDownloadInjections();
		injectThumbnailProgress();
		injectProgressMenuItem();
		trackNativeProgress();
	}).observe(document.body, {
		childList: true,
		subtree: true
	});
	ensureCustomPlayer();
	runDownloadInjections();
	injectThumbnailProgress();
	trackNativeProgress();
})(Hls);
