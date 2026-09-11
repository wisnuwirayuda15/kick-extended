// ==UserScript==
// @name         Kick Extended
// @namespace    https://github.com/wisnuwirayuda15/kick-extended
// @version      2.0.0
// @author       Wisnu Wirayuda
// @description  Unlock subscriber-only VODs, a custom HLS player with keyboard shortcuts and quality control, chat replay, external player handoff, and video downloads on Kick.
// @icon         https://kick.com/favicon.ico
// @match        *://kick.com/*
// @match        *://www.kick.com/*
// @require      https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js
// @connect      kick.com
// @connect      web.kick.com
// @connect      stream.kick.com
// @connect      api.github.com
// @grant        GM_addStyle
// @grant        GM_info
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
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
	var styles_default = "/* Root player */\n#k-player { background: #000; border-radius: 14px; overflow: hidden; container-type: inline-size; }\n#k-video { width: 100%; height: 100%; object-fit: contain; background: black; }\n#k-track { height: 6px; border-radius: 999px; background: rgba(255,255,255,0.25); }\n#k-progress { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #53fc18, #9dff57); }\n#k-track-tooltip {\n    position: absolute; bottom: calc(100% + 10px); left: 0;\n    transform: translateX(-50%) scale(0.96); padding: 4px 8px; border-radius: 8px;\n    border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(7, 7, 7, 0.72);\n    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);\n    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45); color: #fff; font-size: 12px;\n    line-height: 1.2; white-space: nowrap; pointer-events: none; opacity: 0;\n    transition: opacity .12s ease, transform .12s ease; z-index: 35;\n}\n#k-track-tooltip-time { font-variant-numeric: tabular-nums; }\n#k-track-tooltip.visible { opacity: 1; transform: translateX(-50%) scale(1); }\n#k-track:hover { height: 8px; }\n#k-track.scrubbing { height: 8px; }\n#k-progress::after {\n    content: \"\"; position: absolute; right: 0; top: 50%; width: 13px; height: 13px;\n    border-radius: 50%; background: #53fc18; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.55);\n    transform: translate(50%, -50%) scale(0); transition: transform .12s ease;\n}\n#k-track:hover #k-progress::after,\n#k-track.scrubbing #k-progress::after { transform: translate(50%, -50%) scale(1); }\n#k-time { white-space: nowrap; }\n#k-controls-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }\n#k-controls-left { display: flex; align-items: center; gap: 15px; min-width: 0; }\n#k-controls-right { display: flex; align-items: center; gap: 15px; flex: 0 0 auto; }\n\n/* The player can be narrow because the phone is narrow, or because the chat\n   pane is open on desktop. A container query catches both. */\n@container (max-width: 560px) {\n    #k-controls { padding: 16px 10px 8px 10px; }\n    #k-controls-left, #k-controls-right { gap: 10px; }\n    #k-volume, #k-volume-value { display: none; }\n    #k-time { font-size: 11px; }\n    #k-track { padding: 12px 0; }\n    #k-controls button svg { width: 20px; height: 20px; }\n    #k-quality-btn { padding: 3px 6px; font-size: 11px; }\n    #k-update-btn, #k-ext-btn { width: 25px; height: 25px; }\n    #k-big-play { width: 58px; height: 58px; }\n    #k-big-play svg { width: 30px; height: 30px; }\n    .k-center-seek { width: 40px; height: 40px; }\n    .k-center-seek svg { width: 18px; height: 18px; }\n    #k-seek-back { left: calc(50% - 68px); }\n    #k-seek-fwd { left: calc(50% + 68px); }\n}\n@container (max-width: 380px) {\n    #k-time { font-size: 10px; }\n    #k-seek-back { left: calc(50% - 60px); }\n    #k-seek-fwd { left: calc(50% + 60px); }\n}\n#k-controls { z-index: 20; }\n#k-controls button { transition: transform .15s ease, opacity .15s ease; }\n#k-controls button:hover { transform: scale(1.15); opacity: 1; }\n#k-big-play {\n    opacity: 0; pointer-events: none; transform: translate(-50%, -50%) scale(0.92);\n    transition: opacity .15s ease, transform .15s ease; backdrop-filter: blur(6px);\n    -webkit-backdrop-filter: blur(6px); box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45); z-index: 16;\n}\n#k-big-play.visible { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }\n.k-center-seek {\n    position: absolute; top: 50%; width: 48px; height: 48px; padding: 0;\n    display: flex; align-items: center; justify-content: center;\n    background: rgba(7, 7, 7, 0.72); border: 1px solid rgba(255, 255, 255, 0.18);\n    border-radius: 50%; color: #fff; cursor: pointer;\n    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);\n    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);\n    opacity: 0; pointer-events: none; transform: translate(-50%, -50%) scale(0.92);\n    transition: opacity .15s ease, transform .15s ease; z-index: 16;\n}\n.k-center-seek svg { width: 22px; height: 22px; }\n.k-center-seek.visible { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }\n.k-center-seek.visible:hover { transform: translate(-50%, -50%) scale(1.08); }\n.k-center-seek.bump { transform: translate(-50%, -50%) scale(0.88); transition-duration: .08s; }\n#k-seek-back { left: calc(50% - 88px); }\n#k-seek-fwd { left: calc(50% + 88px); }\n.k-center-seek .k-center-seek-label {\n    position: absolute; font-size: 9px; font-weight: 600; letter-spacing: 0.02em;\n    color: rgba(255, 255, 255, 0.9); pointer-events: none; margin-top: 1px;\n}\n#k-loading {\n    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;\n    background: radial-gradient(circle, rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.5));\n    opacity: 0; pointer-events: none; transition: opacity .18s ease; z-index: 14;\n}\n#k-loading.visible { opacity: 1; }\n.k-loading-spinner {\n    width: 54px; height: 54px; border-radius: 999px; border: 4px solid rgba(255, 255, 255, 0.18);\n    border-top-color: #53fc18; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);\n    animation: kick-unlocker-spin .8s linear infinite;\n}\n@keyframes kick-unlocker-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\n#k-seek-indicator {\n    position: absolute; top: 50%; left: 50%; width: 76px; height: 76px; display: flex;\n    align-items: center; justify-content: center; border-radius: 999px;\n    border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(7, 7, 7, 0.72);\n    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);\n    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45); opacity: 0; pointer-events: none;\n    transform: translate(-50%, -50%) scale(0.92); transition: opacity .15s ease, transform .15s ease; z-index: 15;\n}\n#k-seek-indicator svg { width: 40px; height: 40px; }\n#k-seek-indicator[data-direction=\"backward\"] { left: 34%; }\n#k-seek-indicator[data-direction=\"forward\"] { left: 66%; }\n#k-seek-indicator.visible { opacity: 1; transform: translate(-50%, -50%) scale(1); }\n#k-update-btn {\n    display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px;\n    padding: 0; background: rgba(10, 10, 10, 0.58); border: 1px solid rgba(255, 255, 255, 0.2);\n    color: #fff; border-radius: 8px; cursor: pointer; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);\n}\n/* Sits inside Kick's own control bar, so it borrows their button classes and\n   only needs a nudge of its own. */\n#k-switch-btn[data-kick-nosub] { cursor: pointer; }\n#k-switch-btn[data-kick-nosub][data-active=\"true\"] { color: #53fc18; }\n#k-native-btn {\n    display: none; align-items: center; justify-content: center; width: 28px; height: 28px;\n    padding: 0; background: rgba(10, 10, 10, 0.58); border: 1px solid rgba(255, 255, 255, 0.2);\n    color: #fff; border-radius: 8px; cursor: pointer;\n    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);\n}\n#k-copy-url-btn {\n    display: inline-flex; align-items: center; gap: 5px; vertical-align: middle;\n    margin-left: 8px; padding: 3px 8px; border-radius: 7px;\n    border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(255, 255, 255, 0.08);\n    color: rgba(255, 255, 255, 0.75); font-family: Inter, sans-serif; font-size: 11px;\n    font-weight: 500; line-height: 1.4; white-space: nowrap; cursor: pointer;\n    transition: background .15s ease, color .15s ease;\n}\n#k-copy-url-btn:hover { background: rgba(255, 255, 255, 0.16); color: #fff; }\n#k-copy-url-btn[data-state=\"done\"] { color: #53fc18; border-color: rgba(83, 252, 24, 0.4); }\n#k-copy-url-btn[data-state=\"error\"] { color: #ff6b6b; border-color: rgba(255, 107, 107, 0.4); }\n#k-copy-url-btn svg { width: 13px; height: 13px; flex: 0 0 auto; }\n#k-toast {\n    position: fixed; top: 18px; left: 50%; transform: translateX(-50%);\n    z-index: 2147483000; max-width: 90vw; padding: 10px 16px; border-radius: 10px;\n    border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(7, 7, 7, 0.88);\n    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);\n    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);\n    color: #fff; font-family: Inter, sans-serif; font-size: 13px; line-height: 1.4;\n}\n#k-quality-wrap { position: relative; }\n#k-quality-btn {\n    background: rgba(10, 10, 10, 0.58); border: 1px solid rgba(255, 255, 255, 0.2); color: #fff;\n    border-radius: 8px; padding: 4px 8px; font-size: 12px; cursor: pointer;\n    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);\n}\n#k-quality-menu {\n    position: absolute; right: 0; bottom: calc(100% + 8px); min-width: 92px; max-height: 180px;\n    overflow-y: auto; display: none; flex-direction: column; padding: 6px 0; border-radius: 10px;\n    border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(7, 7, 7, 0.72);\n    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45); z-index: 30;\n}\n#k-quality-wrap.open #k-quality-menu { display: flex; }\n#k-quality-menu .k-quality-option {\n    width: 100%; background: transparent; border: 0; color: #fff; border-radius: 0; padding: 7px 12px;\n    font-size: 12px; cursor: pointer; text-align: left; transition: none; opacity: 1;\n}\n#k-quality-menu .k-quality-option:hover { transform: none; opacity: 1; background: rgba(255, 255, 255, 0.08); }\n#k-quality-menu .k-quality-option.active { background: rgba(83, 252, 24, 0.08); color: #53fc18; }\n.k-ext-wrap { position: relative; display: inline-flex; }\n#k-ext-btn {\n    display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px;\n    padding: 0; background: rgba(10, 10, 10, 0.58); border: 1px solid rgba(255, 255, 255, 0.2);\n    color: #fff; border-radius: 8px; cursor: pointer;\n    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);\n}\n.k-ext-menu {\n    position: absolute; right: 0; bottom: calc(100% + 8px); min-width: 190px; max-height: 240px;\n    overflow-y: auto; display: none; flex-direction: column; padding: 6px 0; border-radius: 10px;\n    border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(7, 7, 7, 0.72);\n    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);\n    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45); z-index: 40;\n    font-family: Inter, sans-serif; text-align: left;\n}\n.k-ext-wrap.open .k-ext-menu { display: flex; }\n.k-ext-menu .k-ext-heading {\n    padding: 6px 12px 4px 12px; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;\n    color: rgba(255, 255, 255, 0.45);\n}\n.k-ext-menu .k-ext-option {\n    width: 100%; background: transparent; border: 0; color: #fff; border-radius: 0; padding: 7px 12px;\n    font-size: 12px; font-weight: 400; cursor: pointer; text-align: left; transition: none;\n    opacity: 1; white-space: nowrap;\n}\n.k-ext-menu .k-ext-option:hover { transform: none; opacity: 1; background: rgba(255, 255, 255, 0.08); }\n.k-ext-menu .k-ext-option.done { color: #53fc18; }\n#k-time { min-width: 90px; text-align: center; }\n#k-volume-wrap { display: inline-flex; align-items: center; gap: 5px; }\n#k-volume-btn {\n    display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px;\n    padding: 0; background: none; border: 0; color: #fff; cursor: pointer; opacity: 0.9;\n}\n#k-volume-btn svg { width: 18px; height: 18px; }\n#k-volume {\n    --k-volume-percent: 100%; width: 96px; height: 8px; padding: 0; border: 0; border-radius: 999px;\n    background: linear-gradient(90deg, #53fc18 0%, #53fc18 var(--k-volume-percent),\n        rgba(7, 7, 7, 0.72) var(--k-volume-percent), rgba(7, 7, 7, 0.72) 100%);\n    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);\n    appearance: none; -webkit-appearance: none; cursor: pointer; overflow: hidden;\n}\n#k-volume::-webkit-slider-runnable-track { height: 8px; border-radius: 999px; background: transparent; }\n#k-volume::-webkit-slider-thumb {\n    -webkit-appearance: none; appearance: none; width: 0; height: 0; margin-top: 4px;\n    border: 0; border-radius: 0; background: transparent; box-shadow: none;\n}\n#k-volume::-moz-range-track { height: 8px; border-radius: 999px; background: rgba(7, 7, 7, 0.72); }\n#k-volume::-moz-range-progress { height: 8px; border-radius: 999px; background: #53fc18; }\n#k-volume::-moz-range-thumb { width: 0; height: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }\n#k-volume-value { min-width: 34px; color: #ddd; font-size: 12px; font-variant-numeric: tabular-nums; text-align: right; }\n";
	var ICONS = {
		play: `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:white;"><path d="M8 5v14l11-7z"/></svg>`,
		pause: `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:white;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
		external: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:1;width:18px;height:18px;"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`,
		maximize: `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:white;"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
		settings: `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:white;"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L5.09 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.58 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
		update: `<svg width="98" height="96" viewBox="0 0 98 96" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:18px;height:18px;"><g clip-path="url(#clip0_730_27136)"><path d="M41.4395 69.3848C28.8066 67.8535 19.9062 58.7617 19.9062 46.9902C19.9062 42.2051 21.6289 37.0371 24.5 33.5918C23.2559 30.4336 23.4473 23.7344 24.8828 20.959C28.7109 20.4805 33.8789 22.4902 36.9414 25.2656C40.5781 24.1172 44.4062 23.543 49.0957 23.543C53.7852 23.543 57.6133 24.1172 61.0586 25.1699C64.0254 22.4902 69.2891 20.4805 73.1172 20.959C74.457 23.543 74.6484 30.2422 73.4043 33.4961C76.4668 37.1328 78.0937 42.0137 78.0937 46.9902C78.0937 58.7617 69.1934 67.6621 56.3691 69.2891C59.623 71.3945 61.8242 75.9883 61.8242 81.252L61.8242 91.2051C61.8242 94.0762 64.2168 95.7031 67.0879 94.5547C84.4102 87.9512 98 70.6289 98 49.1914C98 22.1074 75.9883 6.69539e-07 48.9043 4.309e-07C21.8203 1.92261e-07 -1.9479e-07 22.1074 -4.3343e-07 49.1914C-6.20631e-07 70.4375 13.4941 88.0469 31.6777 94.6504C34.2617 95.6074 36.75 93.8848 36.75 91.3008L36.75 83.6445C35.4102 84.2188 33.6875 84.6016 32.1562 84.6016C25.8398 84.6016 22.1074 81.1563 19.4277 74.7441C18.375 72.1602 17.2266 70.6289 15.0254 70.3418C13.877 70.2461 13.4941 69.7676 13.4941 69.1934C13.4941 68.0449 15.4082 67.1836 17.3223 67.1836C20.0977 67.1836 22.4902 68.9063 24.9785 72.4473C26.8926 75.2227 28.9023 76.4668 31.2949 76.4668C33.6875 76.4668 35.2187 75.6055 37.4199 73.4043C39.0469 71.7773 40.291 70.3418 41.4395 69.3848Z" fill="white"/></g><defs><clipPath id="clip0_730_27136"><rect width="98" height="96" fill="white"/></clipPath></defs></svg>`,
		bigPlay: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:1;width:40px;height:40px;"><path fill="none" d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>`,
		swap: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:1;width:18px;height:18px;"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>`,
		bigPause: `<svg viewBox="0 0 24 24" style="width:34px;height:34px;fill:white;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
		backward: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:1;"><path d="M12 6a2 2 0 0 0-3.414-1.414l-6 6a2 2 0 0 0 0 2.828l6 6A2 2 0 0 0 12 18z"/><path d="M22 6a2 2 0 0 0-3.414-1.414l-6 6a2 2 0 0 0 0 2.828l6 6A2 2 0 0 0 22 18z"/></svg>`,
		forward: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:1;"><path d="M12 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 12 18z"/><path d="M2 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 2 18z"/></svg>`,
		volumeHigh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:1;"><path fill="none" d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298zM16 9a5 5 0 0 1 0 6m3.364 3.364a9 9 0 0 0 0-12.728"/></svg>`,
		volumeMedium: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:1;"><path fill="none" d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298zM16 9a5 5 0 0 1 0 6"/></svg>`,
		volumeLow: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:1;"><path fill="none" d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/></svg>`,
		volumeMute: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:1;"><path fill="none" d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298zM22 9l-6 6m0-6l6 6"/></svg>`
	};
	var SUBSCRIBER_ONLY_SELECTOR = "[data-testid=\"video-subscriber-only\"]";
	var CONTROL_ANCHOR_SELECTOR = "[data-testid=\"video-player-clip\"]";
	var BADGE_SELECTOR = "svg[data-ds-icon=\"VerifiedBadge\"]";
	var CHANNEL_NAME_SELECTOR = "h1#channel-username";
	var NATIVE_VIDEO_SELECTOR = "#video-player";
	var NATIVE_VIDEO_FALLBACK_SELECTOR = "video:not(#k-video)";
	var PLAYER_CONTAINER_SELECTOR = ".relative.flex.flex-col";
	var SUBSCRIBER_OVERLAY_CONTAINER_SELECTOR = ".relative.flex.flex-col.items-center.justify-center.overflow-hidden.rounded";
	var KICK_CHAT_SELECTOR = "#chatroom-messages";
	var STORAGE_PREFIX = "kick_extended_";
	var LEGACY_STORAGE_PREFIX = "kick_unlocker_";
	var AUTO_CUSTOM_KEY = `${STORAGE_PREFIX}prefer_custom`;
	function gmFetch(url, opts = {}) {
		return new Promise((resolve, reject) => {
			GM_xmlhttpRequest({
				method: opts.method || "GET",
				url,
				headers: opts.headers || {},
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
	function getPreferCustom() {
		return readMigrated(AUTO_CUSTOM_KEY) === "1";
	}
	function setPreferCustom() {
		localStorage.setItem(AUTO_CUSTOM_KEY, "1");
	}
	function clearPreferCustom() {
		removeBoth(AUTO_CUSTOM_KEY);
	}
	function normalizeVersion(version) {
		return String(version || "").trim().replace(/^v/i, "").split(/[^0-9]+/).filter(Boolean).map((part) => parseInt(part, 10));
	}
	function isVersionGreater(candidateVersion, currentVersion) {
		const candidateParts = normalizeVersion(candidateVersion);
		const currentParts = normalizeVersion(currentVersion);
		const maxLength = Math.max(candidateParts.length, currentParts.length);
		for (let index = 0; index < maxLength; index++) {
			const candidate = candidateParts[index] || 0;
			const current = currentParts[index] || 0;
			if (candidate > current) return true;
			if (candidate < current) return false;
		}
		return false;
	}
	function formatTime(seconds) {
		if (!isFinite(seconds) || seconds < 0) return "0:00";
		const h = Math.floor(seconds / 3600);
		const m = Math.floor(seconds % 3600 / 60);
		const s = Math.floor(seconds % 60);
		if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
		else return `${m}:${s.toString().padStart(2, "0")}`;
	}
	function getVolumeIcon(volume) {
		if (volume <= 0) return ICONS.volumeMute;
		if (volume < .2) return ICONS.volumeLow;
		if (volume < .5) return ICONS.volumeMedium;
		return ICONS.volumeHigh;
	}
	function showToast(message, duration = 5e3) {
		document.querySelector("#k-toast")?.remove();
		const toast = document.createElement("div");
		toast.id = "k-toast";
		toast.textContent = message;
		document.body.appendChild(toast);
		setTimeout(() => toast.remove(), duration);
	}
	var latestReleasePromise = null;
	async function getLatestReleaseAsync() {
		try {
			const response = await gmFetch("https://api.github.com/repos/Enmn/KickNoSub/releases/latest", { headers: { Accept: "application/vnd.github+json" } });
			if (!response.ok) return null;
			const data = response.json();
			return {
				tagName: data.tag_name,
				htmlUrl: data.html_url,
				name: data.name
			};
		} catch (e) {
			return null;
		}
	}
	function getLatestReleaseInfo() {
		if (latestReleasePromise) return latestReleasePromise;
		latestReleasePromise = getLatestReleaseAsync().then((release) => {
			const currentVersion = GM_info.script.version;
			if (release?.tagName && release?.htmlUrl && isVersionGreater(release.tagName, currentVersion)) return release;
			return null;
		}).catch(() => null);
		return latestReleasePromise;
	}
	async function getVideoMetadata(channelSlug, videoSlug) {
		try {
			const chRes = await gmFetch(`https://kick.com/api/v2/channels/${channelSlug}`);
			if (!chRes.ok) return null;
			const channelId = chRes.json().id;
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
				channelSlug
			};
		} catch (e) {
			return null;
		}
	}
	async function findStreamUrlFromMetadata(metadata) {
		const { video } = metadata;
		if (!video) return null;
		const thumbUrl = video.thumbnail && video.thumbnail.src ? video.thumbnail.src : "";
		const thumbParts = thumbUrl.split("/");
		const idx = thumbParts.indexOf("video_thumbnails");
		if (idx === -1 || idx + 2 >= thumbParts.length) {
			console.error("Kick Unlocker: Could not parse session/segment from thumbnail", thumbUrl);
			return null;
		}
		const sessionId = thumbParts[idx + 1];
		const segmentId = thumbParts[idx + 2];
		const startTime = new Date(video.start_time.replace(" ", "T") + (video.start_time.endsWith("Z") ? "" : "Z"));
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
	async function resolveStream(channelSlug, videoSlug) {
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
	(function() {
		"use strict";
		console.log("Kick Unlocker: Userscript loaded (v20.0 - Instant Zap)");
		GM_addStyle(styles_default);
		let activeHls = null;
		let activeChatController = null;
		let nativeExternalCache = null;
		let isUnlocking = false;
		let activePlayerUi = null;
		let globalPlayerListenersBound = false;
		function bindGlobalPlayerListeners() {
			if (globalPlayerListenersBound) return;
			document.addEventListener("click", (event) => {
				[activePlayerUi?.qualWrap, activePlayerUi?.extWrap].forEach((wrap) => {
					if (!wrap || !wrap.isConnected) return;
					if (!wrap.contains(event.target)) wrap.classList.remove("open");
				});
			});
			document.addEventListener("pointerup", (event) => {
				const focusHolder = event.target?.closest?.("#k-controls button, #k-controls input, #k-big-play, .k-center-seek");
				if (focusHolder) focusHolder.blur();
			});
			document.addEventListener("keydown", (event) => {
				const playerUi = activePlayerUi;
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
		function isVodPage() {
			const pathParts = window.location.pathname.split("/").filter(Boolean);
			return pathParts.length >= 3 && (pathParts[1] === "videos" || pathParts[1] === "video");
		}
		function stopNativePlayback(scope) {
			(scope || document).querySelectorAll("video").forEach((videoElement) => {
				if (videoElement.id === "k-video") return;
				try {
					videoElement.pause();
					videoElement.removeAttribute("src");
					videoElement.load();
				} catch (e) {}
			});
		}
		let autoSwitchTimer = null;
		function makeVideoTitle(result) {
			return (result?.video?.session_title || document.title || "kick-vod").replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 80) || "kick-vod";
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
		function destroyCustomPlayer() {
			if (activeHls) {
				try {
					activeHls.destroy();
				} catch (e) {}
				activeHls = null;
			}
			if (activeChatController) {
				try {
					activeChatController.stop();
				} catch (e) {}
				activeChatController = null;
			}
			const customVideo = activePlayerUi?.vid || document.querySelector("#k-video");
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
			clearTimeout(autoSwitchTimer);
			autoSwitchTimer = null;
			nativeExternalCache = null;
			activePlayerUi = null;
			isUnlocking = false;
		}
		let lastHref = window.location.href;
		function handleLocationChange() {
			if (window.location.href === lastHref) return;
			lastHref = window.location.href;
			destroyCustomPlayer();
		}
		["pushState", "replaceState"].forEach((method) => {
			const original = history[method];
			history[method] = function(...args) {
				const returned = original.apply(this, args);
				handleLocationChange();
				return returned;
			};
		});
		window.addEventListener("popstate", handleLocationChange);
		window.addEventListener("hashchange", handleLocationChange);
		window.addEventListener("pagehide", destroyCustomPlayer);
		function getNativeVideo() {
			const byId = document.querySelector(NATIVE_VIDEO_SELECTOR);
			if (byId && byId.id !== "k-video") return byId;
			return document.querySelector(NATIVE_VIDEO_FALLBACK_SELECTOR);
		}
		function isNativePlayerReady() {
			const nativeVideo = getNativeVideo();
			if (!nativeVideo) return false;
			const rect = nativeVideo.getBoundingClientRect();
			if (rect.width < 120 || rect.height < 70) return false;
			return nativeVideo.readyState >= 1 || Boolean(nativeVideo.currentSrc);
		}
		function findCopyButtonAnchor() {
			const badge = document.querySelector(BADGE_SELECTOR);
			if (badge?.parentElement) return badge;
			return document.querySelector(CHANNEL_NAME_SELECTOR);
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
				const pathParts = window.location.pathname.split("/").filter(Boolean);
				const channelSlug = pathParts[0];
				const videoSlug = pathParts[2];
				const cacheKey = `${channelSlug}/${videoSlug}`;
				if (nativeExternalCache?.key !== cacheKey) {
					button.dataset.busy = "1";
					setLabel("Loading...", null);
					const resolved = await resolveStream(channelSlug, videoSlug);
					delete button.dataset.busy;
					if (!resolved) {
						setLabel("Stream not found", "error");
						setTimeout(() => setLabel(defaultLabel, null), 2500);
						return;
					}
					nativeExternalCache = {
						key: cacheKey,
						...resolved
					};
				}
				GM_setClipboard(nativeExternalCache.streamUrl, "text");
				setLabel("Copied", "done");
				setTimeout(() => setLabel(defaultLabel, null), 1600);
			});
			anchor.parentElement.insertBefore(button, anchor.nextSibling);
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
				const rect = node.getBoundingClientRect();
				if (rect.width > videoRect.width * 1.15 || rect.height > videoRect.height * 1.3) break;
				bestMatch = node;
				node = node.parentElement;
			}
			return bestMatch;
		}
		function ensureCustomPlayerToggle() {
			if (!isVodPage() || isUnlocking) return;
			if (document.querySelector("[data-testid=\"video-subscriber-only\"]")) return;
			const container = findNativePlayerContainer();
			if (!container || container.dataset.kickUnlockerProcessing) return;
			const switchToCustom = () => unlockVideo(null, {
				explicitContainer: container,
				manualSwitch: true
			});
			if (getPreferCustom()) {
				if (autoSwitchTimer || !isNativePlayerReady()) return;
				autoSwitchTimer = setTimeout(() => {
					autoSwitchTimer = null;
					if (isUnlocking || !isNativePlayerReady()) return;
					const readyContainer = findNativePlayerContainer();
					if (!readyContainer || readyContainer.dataset.kickUnlockerProcessing) return;
					showToast("KickNoSub: otomatis pindah ke custom player. Pakai tombol swap di control bar buat balik ke player Kick.", 6e3);
					unlockVideo(null, {
						explicitContainer: readyContainer,
						manualSwitch: true
					});
				}, 700);
				return;
			}
			const anchorButton = document.querySelector(CONTROL_ANCHOR_SELECTOR);
			if (!anchorButton || !anchorButton.parentElement) return;
			if (anchorButton.parentElement.querySelector("#k-switch-btn")) return;
			const switchButton = document.createElement("button");
			switchButton.id = "k-switch-btn";
			switchButton.type = "button";
			switchButton.dataset.kickNosub = "true";
			switchButton.title = "Ganti ke player KickNoSub";
			switchButton.setAttribute("aria-label", "Ganti ke player KickNoSub");
			switchButton.className = anchorButton.className;
			switchButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block shrink-0" xmlns="http://www.w3.org/2000/svg"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>`;
			switchButton.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				setPreferCustom();
				switchToCustom();
			});
			anchorButton.parentElement.insertBefore(switchButton, anchorButton);
			injectNativeExternalButton(anchorButton, switchButton);
		}
		function injectNativeExternalButton(anchorButton, switchButton) {
			if (anchorButton.parentElement.querySelector("#k-native-ext-wrap")) return;
			const wrap = document.createElement("div");
			wrap.id = "k-native-ext-wrap";
			wrap.className = "k-ext-wrap";
			const button = document.createElement("button");
			button.type = "button";
			button.title = "Buka di player eksternal";
			button.setAttribute("aria-label", "Buka di player eksternal");
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
				const pathParts = window.location.pathname.split("/").filter(Boolean);
				const channelSlug = pathParts[0];
				const videoSlug = pathParts[2];
				const cacheKey = `${channelSlug}/${videoSlug}`;
				wrap.classList.add("open");
				if (nativeExternalCache?.key !== cacheKey) {
					menu.innerHTML = `<div class="k-ext-heading">Mengambil stream URL...</div>`;
					const resolved = await resolveStream(channelSlug, videoSlug);
					if (!resolved) {
						menu.innerHTML = `<div class="k-ext-heading">Stream tidak ketemu</div>`;
						return;
					}
					nativeExternalCache = {
						key: cacheKey,
						...resolved
					};
				}
				populateExternalMenu(menu, buildExternalTargets(nativeExternalCache.streamUrl, makeVideoTitle(nativeExternalCache.result)), closeMenu);
			});
			document.addEventListener("click", (event) => {
				if (wrap.isConnected && !wrap.contains(event.target)) closeMenu();
			});
			wrap.appendChild(button);
			wrap.appendChild(menu);
			switchButton.parentElement.insertBefore(wrap, switchButton);
		}
		async function unlockVideo(triggerElement, options = {}) {
			const { explicitContainer = null, manualSwitch = false } = options;
			if (isUnlocking) return;
			const container = explicitContainer || triggerElement?.closest(".relative.flex.flex-col") || null;
			if (!container || container.dataset.kickUnlockerProcessing) return;
			const pathParts = window.location.pathname.split("/").filter(Boolean);
			let channelSlug = pathParts[0];
			let videoSlug = pathParts[2];
			if (!videoSlug && pathParts[1] === "video") videoSlug = pathParts[2];
			const resumeKey = getResumeKey(channelSlug, videoSlug);
			const playerSettingsKey = getPlayerSettingsKey(channelSlug, videoSlug);
			const savedPlayerSettings = loadPlayerSettings(playerSettingsKey);
			isUnlocking = true;
			try {
				let prefetched = null;
				if (manualSwitch) {
					prefetched = await resolveStream(channelSlug, videoSlug);
					if (!prefetched) {
						clearPreferCustom();
						showToast("KickNoSub: stream tidak ketemu, tetap pakai player Kick. Auto-switch dimatikan.");
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
				if (activeHls) {
					activeHls.destroy();
					activeHls = null;
				}
				container.innerHTML = `
            <div style="width:100%;height:100%;min-height:${fallbackMinHeight}px;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Inter,sans-serif;">
                <div style="font-size:18px;color:rgba(255,255,255,0.7);">Loading stream...</div>
            </div>
        `;
				const result = prefetched?.result || await getVideoMetadata(channelSlug, videoSlug);
				if (!result) return;
				const streamUrl = prefetched?.streamUrl || await findStreamUrlFromMetadata(result);
				if (!streamUrl) {
					container.innerHTML = `
              <div style="width:100%;height:100%;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Inter,sans-serif;">
                  <div style="font-size:20px;color:rgba(255,255,255,0.7);font-weight:bold;">Stream Not Found</div>
              </div>`;
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
					container.innerHTML = `<div style="display:flex;width:100%;height:100%;"><div id="unlocker-video-area" style="flex:1;background:#000;position:relative;"></div><div id="unlocker-chat-area" style="width:320px;height:100%;border-left:1px solid #333;"></div></div>`;
					chatRoot = container.querySelector("#unlocker-chat-area");
				}
				const startTime = new Date(result.video.start_time.replace(" ", "T") + (result.video.start_time.endsWith("Z") ? "" : "Z"));
				const chatController = new ChatController(result.channelId, startTime, chatRoot);
				chatController.init(null);
				activeChatController = chatController;
				const finalUrl = streamUrl + (streamUrl.includes("?") ? "&" : "?") + "kick_ts=" + Date.now();
				let videoParent = existingChat ? container : container.querySelector("#unlocker-video-area");
				videoParent.innerHTML = `
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
                            <button id="k-update-btn" type="button" title="Open latest update" style="display:none;">${ICONS.update}</button>
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
				const pRoot = videoParent.querySelector("#k-player");
				const vid = videoParent.querySelector("#k-video");
				const controls = videoParent.querySelector("#k-controls");
				const btnPlay = videoParent.querySelector("#k-play");
				const btnFs = videoParent.querySelector("#k-fs");
				const btnUpdate = videoParent.querySelector("#k-update-btn");
				const btnNative = videoParent.querySelector("#k-native-btn");
				if (manualSwitch && btnNative) {
					btnNative.style.display = "inline-flex";
					btnNative.addEventListener("click", (event) => {
						event.stopPropagation();
						clearPreferCustom();
						window.location.reload();
					});
				}
				const btnBig = videoParent.querySelector("#k-big-play");
				const btnSeekBack = videoParent.querySelector("#k-seek-back");
				const btnSeekFwd = videoParent.querySelector("#k-seek-fwd");
				const progressBar = videoParent.querySelector("#k-progress");
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
				const seekIndicator = videoParent.querySelector("#k-seek-indicator");
				const loadingOverlay = videoParent.querySelector("#k-loading");
				const volumeWrap = videoParent.querySelector("#k-volume-wrap");
				const volumeButton = videoParent.querySelector("#k-volume-btn");
				const volumeSlider = videoParent.querySelector("#k-volume");
				const volumeValue = videoParent.querySelector("#k-volume-value");
				const initialVolume = Number.isFinite(savedPlayerSettings.volume) ? savedPlayerSettings.volume : 1;
				let seekIndicatorTimeout = null;
				let hasStartedPlayback = false;
				let loadingStateTimeout = null;
				let previousVolumeBeforeMute = initialVolume > 0 ? initialVolume : 1;
				const updateVolumeSliderVisual = (volume) => {
					const percent = Math.max(0, Math.min(100, Math.round(volume * 100)));
					volumeSlider.style.setProperty("--k-volume-percent", `${percent}%`);
					volumeValue.textContent = `${percent}%`;
					volumeButton.innerHTML = getVolumeIcon(volume);
					volumeButton.setAttribute("aria-label", percent === 0 ? "Unmute volume" : "Mute volume");
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
						if (!vid.paused && !vid.ended) loadingOverlay.classList.add("visible");
					}, 250);
				};
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
				const setCenterSeekVisible = (visible) => {
					[btnSeekBack, btnSeekFwd].forEach((button) => button.classList.toggle("visible", visible));
				};
				const syncBigButton = () => {
					btnBig.innerHTML = vid.paused ? ICONS.bigPlay : ICONS.bigPause;
					btnBig.classList.toggle("visible", touchMode ? controlsShown || vid.paused : vid.paused);
				};
				const hideControlsNow = () => {
					clearTimeout(controlsHideTimeout);
					controls.style.opacity = "0";
					setCenterSeekVisible(false);
					trackTooltip.classList.remove("visible");
					qualWrap.classList.remove("open");
					extWrap.classList.remove("open");
					controlsShown = false;
					syncBigButton();
					if (document.fullscreenElement) pRoot.style.cursor = "none";
				};
				const scheduleControlsHide = () => {
					clearTimeout(controlsHideTimeout);
					controlsHideTimeout = setTimeout(() => {
						if (vid.paused) return;
						if (pointerOverControls) return;
						if (qualWrap.classList.contains("open")) return;
						if (extWrap.classList.contains("open")) return;
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
				activePlayerUi = {
					vid,
					pRoot,
					qualWrap,
					extWrap,
					btnFs,
					showSeekIndicator,
					showControls,
					renderProgress: (time) => renderProgress(time),
					applyVolume: (volume) => applyVolume(volume),
					togglePlay: () => togglePlay()
				};
				bindGlobalPlayerListeners();
				applyVolume(initialVolume, { persist: false });
				getLatestReleaseInfo().then((release) => {
					if (!release || !btnUpdate?.isConnected) return;
					btnUpdate.style.display = "inline-flex";
					btnUpdate.title = `Update available: ${release.name || release.tagName}`;
					btnUpdate.addEventListener("click", () => {
						window.open(release.htmlUrl, "_blank", "noopener,noreferrer");
					}, { once: true });
				});
				populateExternalMenu(extMenu, buildExternalTargets(streamUrl, makeVideoTitle(result)), () => extWrap.classList.remove("open"));
				extBtn.addEventListener("click", (event) => {
					event.stopPropagation();
					qualWrap.classList.remove("open");
					extWrap.classList.toggle("open");
				});
				qualBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					extWrap.classList.remove("open");
					qualWrap.classList.toggle("open");
				});
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
					syncBigButton();
				});
				vid.addEventListener("pause", () => {
					btnPlay.innerHTML = ICONS.play;
					syncBigButton();
				});
				vid.addEventListener("playing", () => {
					hasStartedPlayback = true;
					setLoadingState(false);
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
				vid.addEventListener("timeupdate", () => {
					if (Date.now() - lastSave > 4e3) {
						saveResumeTime(resumeKey, vid.currentTime);
						lastSave = Date.now();
					}
					if (isFinite(vid.duration) && !isScrubbing) renderProgress(vid.currentTime);
				});
				vid.addEventListener("ended", () => {
					clearResumeTime(resumeKey);
				});
				const renderProgress = (time) => {
					if (!isFinite(vid.duration)) return;
					progressBar.style.width = time / vid.duration * 100 + "%";
					timeDisplay.textContent = `${formatTime(time)} / ${formatTime(vid.duration)}`;
				};
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
					trackTooltipTime.textContent = formatTime(ratio * vid.duration);
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
					trackTooltipTime.textContent = formatTime(ratio * vid.duration);
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
					qualWrap.classList.remove("open");
					extWrap.classList.remove("open");
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
					if (pRoot.isConnected) showControls();
				});
				btnFs.addEventListener("click", () => {
					if (!document.fullscreenElement) pRoot.requestFullscreen();
					else document.exitFullscreen();
				});
				vid.addEventListener("dblclick", () => {
					if (lastPointerType === "mouse") btnFs.click();
				});
				if (hls_js.default.isSupported()) {
					const hls = new hls_js.default({
						debug: false,
						enableWorker: false,
						lowLatencyMode: true
					});
					activeHls = hls;
					hls.loadSource(finalUrl);
					hls.attachMedia(vid);
					hls.on(hls_js.default.Events.MANIFEST_LOADING, () => setLoadingState(true, { immediate: true }));
					hls.on(hls_js.default.Events.MANIFEST_PARSED, () => {
						setLoadingState(false);
						const setQuality = (level, label, optionRef = null, qualitySettings = null) => {
							hls.currentLevel = level;
							qualBtn.textContent = `${label} ▴`;
							[...qualMenu.querySelectorAll(".k-quality-option")].forEach((option) => option.classList.remove("active"));
							if (optionRef) optionRef.classList.add("active");
							if (qualitySettings) savePlayerSettings(playerSettingsKey, { quality: qualitySettings });
							qualWrap.classList.remove("open");
						};
						const addQualityItem = (level, label, qualitySettings, isActive = false) => {
							const item = document.createElement("button");
							item.type = "button";
							item.className = "k-quality-option";
							item.textContent = label;
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
								label: `${lvl.height}p`,
								element: addQualityItem(idx, `${lvl.height}p`, {
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
			} catch (e) {
				console.error(e);
				if (container) delete container.dataset.kickUnlockerProcessing;
			} finally {
				isUnlocking = false;
			}
		}
		new MutationObserver(() => {
			handleLocationChange();
			if (activePlayerUi?.vid && !activePlayerUi.vid.isConnected) destroyCustomPlayer();
			const subscriberOverlay = document.querySelector(SUBSCRIBER_ONLY_SELECTOR);
			ensureCopyUrlButton();
			if (subscriberOverlay) {
				const outerContainer = subscriberOverlay.closest(SUBSCRIBER_OVERLAY_CONTAINER_SELECTOR);
				if (outerContainer && !outerContainer.dataset.kickUnlockerProcessing && !isUnlocking) unlockVideo(subscriberOverlay);
				return;
			}
			ensureCustomPlayerToggle();
		}).observe(document.body, {
			childList: true,
			subtree: true
		});
		ensureCustomPlayerToggle();
	})();
})(Hls);
