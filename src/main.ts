import Hls from "hls.js";
import css from "./styles.css?raw";

(function () {
  "use strict";

  console.log("Kick Unlocker: Userscript loaded (v20.0 - Instant Zap)");

  // Content scripts bypass CORS; a userscript's page fetch does not.
  // Route every cross-origin call through GM_xmlhttpRequest instead.
  function gmFetch(url, opts: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: opts.method || "GET",
        url,
        headers: opts.headers || {},
        timeout: opts.timeout || 15000,
        onload: (r) =>
          resolve({
            ok: r.status >= 200 && r.status < 300,
            status: r.status,
            json: () => JSON.parse(r.responseText),
            text: () => r.responseText,
          }),
        onerror: () => reject(new Error("network")),
        ontimeout: () => reject(new Error("timeout")),
      });
    });
  }

  GM_addStyle(css);

  let activeHls = null;
  let activeChatController = null;
  let nativeExternalCache = null;
  let isUnlocking = false;
  let latestReleasePromise = null;
  let activePlayerUi = null;
  let globalPlayerListenersBound = false;

  // --- SVG ICONS ---
  const ICONS = {
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
    volumeMute: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:1;"><path fill="none" d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298zM22 9l-6 6m0-6l6 6"/></svg>`,
  };

  function getResumeKey(channelSlug, videoSlug) {
    return `kick_unlocker_resume:${channelSlug}:${videoSlug}`;
  }

  function getPlayerSettingsKey(channelSlug, videoSlug) {
    return `kick_unlocker_settings:${channelSlug}:${videoSlug}`;
  }

  function loadPlayerSettings(settingsKey) {
    try {
      const raw = localStorage.getItem(settingsKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function savePlayerSettings(settingsKey, partialSettings) {
    const currentSettings = loadPlayerSettings(settingsKey);
    localStorage.setItem(
      settingsKey,
      JSON.stringify({
        ...currentSettings,
        ...partialSettings,
      }),
    );
  }

  function normalizeVersion(version) {
    return String(version || "")
      .trim()
      .replace(/^v/i, "")
      .split(/[^0-9]+/)
      .filter(Boolean)
      .map((part) => parseInt(part, 10));
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

  async function getLatestReleaseAsync() {
    try {
      const response = await gmFetch(
        "https://api.github.com/repos/Enmn/KickNoSub/releases/latest",
        {
          headers: { Accept: "application/vnd.github+json" },
        },
      );
      if (!response.ok) return null;
      const data = response.json();
      return {
        tagName: data.tag_name,
        htmlUrl: data.html_url,
        name: data.name,
      };
    } catch (e) {
      return null;
    }
  }

  function getLatestReleaseInfo() {
    if (latestReleasePromise) return latestReleasePromise;

    latestReleasePromise = getLatestReleaseAsync()
      .then((release) => {
        const currentVersion = GM_info.script.version;
        if (
          release?.tagName &&
          release?.htmlUrl &&
          isVersionGreater(release.tagName, currentVersion)
        ) {
          return release;
        }
        return null;
      })
      .catch(() => null);

    return latestReleasePromise;
  }

  function bindGlobalPlayerListeners() {
    if (globalPlayerListenersBound) return;

    document.addEventListener("click", (event) => {
      [activePlayerUi?.qualWrap, activePlayerUi?.extWrap].forEach((wrap) => {
        if (!wrap || !wrap.isConnected) return;
        if (!wrap.contains(event.target)) wrap.classList.remove("open");
      });
    });

    // Player controls keep DOM focus after a click, so the keydown handler
    // below would see them as the event target and bail out. Drop focus once
    // the pointer is released so later key presses reach the player.
    document.addEventListener("pointerup", (event) => {
      const focusHolder = (event.target as any)?.closest?.(
        "#k-controls button, #k-controls input, #k-big-play, .k-center-seek",
      );
      if (focusHolder) focusHolder.blur();
    });

    document.addEventListener(
      "keydown",
      (event) => {
        const playerUi = activePlayerUi;
        const videoElement = playerUi?.vid;
        if (!videoElement || !videoElement.isConnected) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        const target: any = event.target;
        if (
          target?.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)
        )
          return;

        const seekBy = (seconds) => {
          if (!isFinite(videoElement.duration)) return;
          videoElement.currentTime = Math.min(
            Math.max(videoElement.currentTime + seconds, 0),
            videoElement.duration,
          );
          playerUi.showSeekIndicator(seconds > 0 ? "forward" : "backward");
          playerUi.renderProgress?.(videoElement.currentTime);
        };

        const seekToPercent = (percent) => {
          if (!isFinite(videoElement.duration)) return;
          const target = videoElement.duration * percent;
          const direction =
            target > videoElement.currentTime ? "forward" : "backward";
          videoElement.currentTime = target;
          playerUi.showSeekIndicator(direction);
          playerUi.renderProgress?.(target);
        };

        const nudgeVolume = (delta) =>
          playerUi.applyVolume(
            Math.min(Math.max(videoElement.volume + delta, 0), 1),
          );

        const setRate = (delta) => {
          videoElement.playbackRate = Math.min(
            Math.max(videoElement.playbackRate + delta, 0.25),
            4,
          );
        };

        const shortcuts = {
          arrowright: () => seekBy(5),
          arrowleft: () => seekBy(-5),
          l: () => seekBy(10),
          j: () => seekBy(-10),
          arrowup: () => nudgeVolume(0.05),
          arrowdown: () => nudgeVolume(-0.05),
          " ": () => playerUi.togglePlay(),
          k: () => playerUi.togglePlay(),
          f: () => playerUi.btnFs.click(),
          m: () =>
            playerUi.applyVolume(videoElement.volume === 0 ? 0.5 : 0),
          ">": () => setRate(0.25),
          ".": () => setRate(0.25),
          "<": () => setRate(-0.25),
          ",": () => setRate(-0.25),
          home: () => seekToPercent(0),
          end: () => seekToPercent(0.999),
        };

        for (let digit = 0; digit <= 9; digit++) {
          shortcuts[String(digit)] = () => seekToPercent(digit / 10);
        }

        const action = shortcuts[event.key.toLowerCase()];
        if (!action) return;

        event.preventDefault();
        event.stopPropagation();
        action();
        playerUi.showControls?.();
      },
      true, // capture phase, so this runs ahead of Kick's own key handlers
    );

    globalPlayerListenersBound = true;
  }

  function checkStreamUrl(url) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: "HEAD",
        url,
        timeout: 3000,
        onload: (r) => resolve(r.status >= 200 && r.status < 300 ? url : null),
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
      });
    });
  }

  async function getVideoMetadata(channelSlug, videoSlug) {
    try {
      const chRes = await gmFetch(
        `https://kick.com/api/v2/channels/${channelSlug}`,
      );
      if (!chRes.ok) return null;
      const chData = chRes.json();
      const channelId = chData.id;

      const vidRes = await gmFetch(
        `https://web.kick.com/api/v1/channels/${channelId}/videos`,
        {
          headers: {
            Accept: "application/json",
            "Alt-Used": "web.kick.com",
            Origin: "https://kick.com",
            Referer: "https://kick.com/",
          },
        },
      );
      if (!vidRes.ok) return null;

      const vidData = vidRes.json();
      let videosList = vidData.data || vidData.videos || [];
      if (Array.isArray(vidData)) videosList = vidData;

      const targetVideo = videosList.find((v) => String(v.id) === videoSlug);
      if (!targetVideo) return null;

      return {
        video: targetVideo,
        channelId: channelId,
        channelSlug: channelSlug,
      };
    } catch (e) {
      return null;
    }
  }

  async function findStreamUrlFromMetadata(metadata) {
    const { video } = metadata;
    if (!video) return null;

    const thumbUrl =
      video.thumbnail && video.thumbnail.src ? video.thumbnail.src : "";
    const thumbParts = thumbUrl.split("/");
    const idx = thumbParts.indexOf("video_thumbnails");

    if (idx === -1 || idx + 2 >= thumbParts.length) {
      console.error(
        "Kick Unlocker: Could not parse session/segment from thumbnail",
        thumbUrl,
      );
      return null;
    }

    const sessionId = thumbParts[idx + 1];
    const segmentId = thumbParts[idx + 2];

    const startTime = new Date(
      video.start_time.replace(" ", "T") +
        (video.start_time.endsWith("Z") ? "" : "Z"),
    );

    const baseUrls = [
      "https://stream.kick.com/ivs/v1/196233775518",
      "https://stream.kick.com/3c81249a5ce0/ivs/v1/196233775518",
      "https://stream.kick.com/0f3cb0ebce7/ivs/v1/196233775518",
    ];

    const tasks = [];
    const offsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];

    for (const offset of offsets) {
      const t = new Date(startTime.getTime() + offset * 60000);
      const y = t.getUTCFullYear();
      const m = t.getUTCMonth() + 1;
      const d = t.getUTCDate();
      const h = t.getUTCHours();
      const min = t.getUTCMinutes();

      for (const base of baseUrls) {
        tasks.push(
          `${base}/${sessionId}/${y}/${m}/${d}/${h}/${min}/${segmentId}/media/hls/master.m3u8`,
        );
      }
    }
    for (const url of tasks) {
      if (await checkStreamUrl(url)) return url;
    }
    return null;
  }

  class ChatController {
    declare channelId: any;
    declare videoStartTime: any;
    declare container: any;
    declare messages: any[];
    declare videoElement: any;
    declare activeSessionId: number;
    declare chatList: any;
    declare lastRenderedMsgId: any;

    constructor(channelId, videoStartTime, container) {
      this.channelId = channelId;
      this.videoStartTime = videoStartTime;
      this.container = container;
      this.messages = [];
      this.videoElement = null;
      this.activeSessionId = 0;
    }

    stop() {
      // fetchLoop runs `while (this.activeSessionId === sessionId)`, so
      // bumping the id is what actually ends it.
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
        this.chatList = this.container.querySelector(
          "#kick-unlocker-chat-list",
        );
      }
      if (initialVideoElement) this.connectVideo(initialVideoElement);
      this.fetchLoop(this.activeSessionId);
    }

    connectVideo(videoElement) {
      this.videoElement = videoElement;
      videoElement.addEventListener("timeupdate", () =>
        this.updateUI(videoElement.currentTime),
      );
      videoElement.addEventListener("seeking", () => {
        this.activeSessionId++;
        this.messages = [];
        if (this.chatList)
          this.chatList.innerHTML =
            '<br><div style="text-align:center;color:#888;">Syncing...</div>';
        this.fetchLoop(this.activeSessionId);
      });
    }

    parseContent(content) {
      if (!content) return "";
      return content.replace(
        /\[emote:(\d+):([^\]]+)\]/g,
        (match, id, name) =>
          `<img src="https://files.kick.com/emotes/${id}/fullsize" alt="${name}" title="${name}" style="height:1.8em;vertical-align:middle;display:inline-block;margin:0 2px;">`,
      );
    }

    async fetchLoop(sessionId) {
      let currentCursor = null;
      while (this.activeSessionId === sessionId) {
        try {
          let url = `https://kick.com/api/v2/channels/${this.channelId}/messages`;
          if (currentCursor) url += `?cursor=${currentCursor}`;
          else {
            let targetTime = this.videoStartTime;
            if (this.videoElement)
              targetTime = new Date(
                this.videoStartTime.getTime() +
                  this.videoElement.currentTime * 1000,
              );
            url += `?start_time=${targetTime.toISOString()}`;
          }
          const res = await gmFetch(url);
          if (!res.ok) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          const data = res.json();
          if (this.activeSessionId !== sessionId) break;

          const msgs = data.messages || (data.data && data.data.messages) || [];
          if (msgs.length) {
            msgs.forEach((msg) => {
              if (!this.messages.some((m) => m.id === msg.id))
                this.messages.push(msg);
            });
            this.messages.sort(
              (a, b) => (new Date(a.created_at) as any) - (new Date(b.created_at) as any),
            );
            if (this.videoElement) this.updateUI(this.videoElement.currentTime);
          }
          currentCursor =
            data.cursor || (data.data && data.data.cursor) || data.next_cursor;
          if (!currentCursor) {
            currentCursor = null;
            await new Promise((r) => setTimeout(r, 2000));
          } // Retry/Recovery
          else {
            if (this.messages.length && this.videoElement) {
              const lastT = new Date(
                this.messages[this.messages.length - 1].created_at,
              ).getTime();
              const vidT =
                this.videoStartTime.getTime() +
                this.videoElement.currentTime * 1000;
              if (lastT > vidT + 60000)
                await new Promise((r) => setTimeout(r, 1000));
              else await new Promise((r) => setTimeout(r, 50));
            } else await new Promise((r) => setTimeout(r, 50));
          }
        } catch (e) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    updateUI(cwdSeconds) {
      if (!this.chatList) return;
      const absTime = this.videoStartTime.getTime() + cwdSeconds * 1000;
      let limit = -1;
      for (let i = this.messages.length - 1; i >= 0; i--) {
        if (new Date(this.messages[i].created_at).getTime() <= absTime) {
          limit = i;
          break;
        }
      }
      if (limit === -1) return;
      const subset = this.messages.slice(Math.max(0, limit - 75), limit + 1);
      const lastM = subset[subset.length - 1];
      if (
        !lastM ||
        (this.lastRenderedMsgId === lastM.id && subset.length >= 50)
      )
        return;

      this.chatList.innerHTML = subset
        .map(
          (msg) => `
            <div style="margin-bottom:4px;line-height:1.4;word-wrap:break-word;">
                <span style="color:${msg.sender.identity?.color || "#53fc18"};font-weight:bold;margin-right:5px;">${msg.sender.username}:</span>
                <span style="color:#efeff1;">${this.parseContent(msg.content)}</span>
            </div>`,
        )
        .join("");
      this.chatList.scrollTop = this.chatList.scrollHeight;
      this.lastRenderedMsgId = lastM.id;
    }
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "0:00";

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    } else {
      return `${m}:${s.toString().padStart(2, "0")}`;
    }
  }

  function getVolumeIcon(volume) {
    if (volume <= 0) return ICONS.volumeMute;
    if (volume < 0.2) return ICONS.volumeLow;
    if (volume < 0.5) return ICONS.volumeMedium;
    return ICONS.volumeHigh;
  }

  const AUTO_CUSTOM_KEY = "kick_unlocker_prefer_custom";

  function isVodPage() {
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    return (
      pathParts.length >= 3 &&
      (pathParts[1] === "videos" || pathParts[1] === "video")
    );
  }

  function stopNativePlayback(scope) {
    (scope || document).querySelectorAll("video").forEach((videoElement) => {
      if (videoElement.id === "k-video") return;
      try {
        videoElement.pause();
        videoElement.removeAttribute("src");
        videoElement.load();
      } catch (e) {
        /* the element may already be detached */
      }
    });
  }

  const CONTROL_ANCHOR_SELECTOR = '[data-testid="video-player-clip"]';
  const BADGE_SELECTOR = 'svg[data-ds-icon="VerifiedBadge"]';
  const CHANNEL_NAME_SELECTOR = 'h1#channel-username';
  const AUTO_SWITCH_SETTLE_MS = 700;
  let autoSwitchTimer = null;

  function makeVideoTitle(result) {
    const raw = result?.video?.session_title || document.title || "kick-vod";
    return raw.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 80) || "kick-vod";
  }

  function launchScheme(schemeUrl) {
    // A transient anchor lets the browser show its own "open app?" prompt
    // instead of treating this as a page navigation.
    const anchor = document.createElement("a");
    anchor.href = schemeUrl;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => anchor.remove(), 0);
  }

  function downloadPlaylist(externalUrl, videoTitle) {
    const playlist = ["#EXTM3U", `#EXTINF:-1,${videoTitle}`, externalUrl, ""].join(
      "\n",
    );
    const blobUrl = URL.createObjectURL(
      new Blob([playlist], { type: "audio/x-mpegurl" }),
    );
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `${videoTitle}.m3u`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  }

  function buildExternalTargets(externalUrl, videoTitle) {
    return [
      {
        group: "Always works",
        label: "Copy stream URL",
        run: () => GM_setClipboard(externalUrl, "text"),
        feedback: "Copied",
      },
      {
        label: "Download .m3u playlist",
        run: () => downloadPlaylist(externalUrl, videoTitle),
        feedback: "Saved",
      },
      {
        group: "Needs a registered handler",
        label: "VLC",
        run: () => launchScheme(`vlc://${externalUrl}`),
      },
      {
        label: "PotPlayer",
        run: () => launchScheme(`potplayer://${externalUrl}`),
      },
      {
        label: "IINA (macOS)",
        run: () =>
          launchScheme(`iina://weblink?url=${encodeURIComponent(externalUrl)}`),
      },
      {
        label: "mpv (mpv-handler)",
        run: () => {
          // mpv-handler expects base64url of the source URL.
          const encoded = btoa(externalUrl)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
          launchScheme(`mpv://play/${encoded}/`);
        },
      },
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

  // A <video> that React detaches from the DOM keeps decoding audio, and
  // hls.js keeps feeding it, so an SPA navigation has to tear this down by
  // hand rather than relying on the element going away.
  function destroyCustomPlayer() {
    if (activeHls) {
      try {
        activeHls.destroy();
      } catch (e) {
        /* already gone */
      }
      activeHls = null;
    }

    if (activeChatController) {
      try {
        activeChatController.stop();
      } catch (e) {
        /* already gone */
      }
      activeChatController = null;
    }

    const customVideo = activePlayerUi?.vid || document.querySelector("#k-video");
    if (customVideo) {
      try {
        customVideo.pause();
        customVideo.removeAttribute("src");
        customVideo.srcObject = null;
        customVideo.load();
      } catch (e) {
        /* already gone */
      }
      customVideo.remove();
    }

    document.querySelectorAll("#k-player").forEach((el) => el.remove());
    document.querySelector("#k-toast")?.remove();
    document.querySelector("#k-copy-url-btn")?.remove();
    document
      .querySelectorAll("[data-kick-unlocker-processing]")
      .forEach((el) => delete (el as any).dataset.kickUnlockerProcessing);

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

  // Kick routes client-side, so there is no navigation event to hook. Patch
  // the history methods and cover the back/forward button separately.
  ["pushState", "replaceState"].forEach((method) => {
    const original = history[method];
    history[method] = function (...args) {
      const returned = original.apply(this, args);
      handleLocationChange();
      return returned;
    };
  });
  window.addEventListener("popstate", handleLocationChange);
  window.addEventListener("hashchange", handleLocationChange);
  window.addEventListener("pagehide", destroyCustomPlayer);

  function getNativeVideo() {
    const byId = document.querySelector("#video-player");
    if (byId && byId.id !== "k-video") return byId;
    return document.querySelector("video:not(#k-video)");
  }

  function showToast(message, duration = 5000) {
    document.querySelector("#k-toast")?.remove();
    const toast = document.createElement("div");
    toast.id = "k-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  // Kick renders the <video> tag well before the player is actually usable,
  // so element presence alone is a bad signal. The control bar is no help
  // either: it is only mounted on hover. Size plus readyState is.
  function isNativePlayerReady() {
    const nativeVideo: any = getNativeVideo();
    if (!nativeVideo) return false;

    const rect = nativeVideo.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 70) return false;

    return nativeVideo.readyState >= 1 || Boolean(nativeVideo.currentSrc);
  }

  async function resolveStream(channelSlug, videoSlug) {
    try {
      const result = await getVideoMetadata(channelSlug, videoSlug);
      if (!result) return null;
      const streamUrl = await findStreamUrlFromMetadata(result);
      if (!streamUrl) return null;
      return { result, streamUrl };
    } catch (e) {
      return null;
    }
  }

  function findCopyButtonAnchor() {
    const badge = document.querySelector(BADGE_SELECTOR);
    if (badge?.parentElement) return badge;
    return document.querySelector(CHANNEL_NAME_SELECTOR);
  }

  function ensureCopyUrlButton() {
    // Needs a video slug to resolve a stream, so channel pages are out.
    if (!isVodPage()) return;
    if (document.querySelector("#k-copy-url-btn")) return;

    const anchor = findCopyButtonAnchor();
    if (!anchor?.parentElement) return;

    const button = document.createElement("button");
    button.id = "k-copy-url-btn";
    button.type = "button";
    button.title = "Copy stream URL (.m3u8)";
    const defaultLabel = "Copy stream URL";
    const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    button.innerHTML = `${icon}<span>${defaultLabel}</span>`;

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
        nativeExternalCache = { key: cacheKey, ...resolved };
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

    // Kick's Tailwind classes churn between deploys, so this may miss.
    const classMatch = nativeVideo.closest(".relative.flex.flex-col");
    if (classMatch) return classMatch;

    // Fallback: climb while each ancestor still hugs the video box. The
    // control overlay is absolutely positioned inside that same box, so the
    // last tight-fitting ancestor is the player root. The first one that
    // grows noticeably is page chrome and must not be wiped.
    const videoRect = nativeVideo.getBoundingClientRect();
    let node = nativeVideo.parentElement;
    let bestMatch = nativeVideo.parentElement;

    while (node && node !== document.body) {
      const rect = node.getBoundingClientRect();
      if (
        rect.width > videoRect.width * 1.15 ||
        rect.height > videoRect.height * 1.3
      )
        break;
      bestMatch = node;
      node = node.parentElement;
    }

    return bestMatch;
  }

  function ensureCustomPlayerToggle() {
    if (!isVodPage() || isUnlocking) return;
    // Sub-only pages are handled automatically by the observer below.
    if (document.querySelector('[data-testid="video-subscriber-only"]')) return;

    const container: any = findNativePlayerContainer();
    if (!container || container.dataset.kickUnlockerProcessing) return;

    const switchToCustom = () =>
      unlockVideo(null, { explicitContainer: container, manualSwitch: true });

    if (localStorage.getItem(AUTO_CUSTOM_KEY) === "1") {
      if (autoSwitchTimer || !isNativePlayerReady()) return;
      // Let React finish its mount pass before we tear the container down.
      // Re-check afterwards in case the DOM moved during the wait.
      autoSwitchTimer = setTimeout(() => {
        autoSwitchTimer = null;
        if (isUnlocking || !isNativePlayerReady()) return;
        const readyContainer: any = findNativePlayerContainer();
        if (!readyContainer || readyContainer.dataset.kickUnlockerProcessing)
          return;
        showToast(
          "KickNoSub: otomatis pindah ke custom player. Pakai tombol swap di control bar buat balik ke player Kick.",
          6000,
        );
        unlockVideo(null, {
          explicitContainer: readyContainer,
          manualSwitch: true,
        });
      }, AUTO_SWITCH_SETTLE_MS);
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
    // Borrow the sibling's classes so it inherits Kick's sizing, hover and
    // focus treatment instead of being styled from scratch.
    switchButton.className = anchorButton.className;
    switchButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block shrink-0" xmlns="http://www.w3.org/2000/svg"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>`;
    switchButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      localStorage.setItem(AUTO_CUSTOM_KEY, "1");
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
        nativeExternalCache = { key: cacheKey, ...resolved };
      }

      populateExternalMenu(
        menu,
        buildExternalTargets(
          nativeExternalCache.streamUrl,
          makeVideoTitle(nativeExternalCache.result),
        ),
        closeMenu,
      );
    });

    document.addEventListener("click", (event) => {
      if (wrap.isConnected && !wrap.contains(event.target as Node)) closeMenu();
    });

    wrap.appendChild(button);
    wrap.appendChild(menu);
    switchButton.parentElement.insertBefore(wrap, switchButton);
  }

  async function unlockVideo(triggerElement, options: any = {}) {
    const { explicitContainer = null, manualSwitch = false } = options;
    if (isUnlocking) return;
    const container =
      explicitContainer ||
      triggerElement?.closest(".relative.flex.flex-col") ||
      null;
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
      // When we are replacing a native player that already works, resolve the
      // stream first. A failure after the container is wiped leaves the page
      // dead with no way back, so nothing is torn down until this succeeds.
      let prefetched = null;
      if (manualSwitch) {
        prefetched = await resolveStream(channelSlug, videoSlug);
        if (!prefetched) {
          localStorage.removeItem(AUTO_CUSTOM_KEY);
          showToast(
            "KickNoSub: stream tidak ketemu, tetap pakai player Kick. Auto-switch dimatikan.",
          );
          return;
        }
      }

      // Kick's own player may keep decoding audio if we only wipe the DOM
      // around it, so stop it explicitly first.
      stopNativePlayback(container);

      const containerRect = container.getBoundingClientRect();
      const fallbackMinHeight = Math.max(
        Math.round(containerRect.height || 0),
        Math.round(((containerRect.width || 0) * 9) / 16),
        360,
      );

      container.style.width = "100%";
      container.style.minHeight = `${fallbackMinHeight}px`;

      if (containerRect.width > 0 && containerRect.height > 0) {
        container.style.aspectRatio = `${containerRect.width} / ${containerRect.height}`;
      } else {
        container.style.aspectRatio = "16 / 9";
      }

      if (activeHls) {
        activeHls.destroy();
        activeHls = null;
      }

      // --- STEP 1: FULL WIPE & SPLASH ---
      container.innerHTML = `
            <div style="width:100%;height:100%;min-height:${fallbackMinHeight}px;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Inter,sans-serif;">
                <div style="font-size:18px;color:rgba(255,255,255,0.7);">Loading stream...</div>
            </div>
        `;

      const result =
        prefetched?.result || (await getVideoMetadata(channelSlug, videoSlug));
      if (!result) return; // Silent fail or keep deleted

      const streamUrl =
        prefetched?.streamUrl || (await findStreamUrlFromMetadata(result));
      if (!streamUrl) {
        container.innerHTML = `
              <div style="width:100%;height:100%;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Inter,sans-serif;">
                  <div style="font-size:20px;color:rgba(255,255,255,0.7);font-weight:bold;">Stream Not Found</div>
              </div>`;
        return;
      }

      // --- STEP 2: FULL UNLOCK ---
      container.dataset.kickUnlockerProcessing = "true";
      container.innerHTML = ""; // WIPE ALL
      container.style.background = "#000";

      // Check for Chat
      const existingChat: any = document.querySelector("#chatroom-messages");
      let chatRoot = null;
      if (existingChat) {
        existingChat.innerHTML = "";
        existingChat.style.display = "block";
        chatRoot = existingChat;
      } else {
        container.innerHTML = `<div style="display:flex;width:100%;height:100%;"><div id="unlocker-video-area" style="flex:1;background:#000;position:relative;"></div><div id="unlocker-chat-area" style="width:320px;height:100%;border-left:1px solid #333;"></div></div>`;
        chatRoot = container.querySelector("#unlocker-chat-area");
      }

      const startTime = new Date(
        result.video.start_time.replace(" ", "T") +
          (result.video.start_time.endsWith("Z") ? "" : "Z"),
      );
      const chatController = new ChatController(
        result.channelId,
        startTime,
        chatRoot,
      );
      chatController.init(null);
      activeChatController = chatController;

      const finalUrl =
        streamUrl +
        (streamUrl.includes("?") ? "&" : "?") +
        "kick_ts=" +
        Date.now();
      let videoParent =
        existingChat ? container : (
          container.querySelector("#unlocker-video-area")
        );

      // Build Custom Player UI
      const playerHTML = `
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

      videoParent.innerHTML = playerHTML;
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
          localStorage.removeItem(AUTO_CUSTOM_KEY);
          // Kick mounts its player during page bootstrap, so a reload is the
          // only reliable way to get it back.
          window.location.reload();
        });
      }
      const btnBig = videoParent.querySelector("#k-big-play");
      const btnSeekBack = videoParent.querySelector("#k-seek-back");
      const btnSeekFwd = videoParent.querySelector("#k-seek-fwd");
      const progressBar = videoParent.querySelector("#k-progress");
      const track = videoParent.querySelector("#k-track");
      const trackTooltip = videoParent.querySelector("#k-track-tooltip");
      const trackTooltipTime = videoParent.querySelector(
        "#k-track-tooltip-time",
      );
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
      const initialVolume =
        Number.isFinite(savedPlayerSettings.volume) ?
          savedPlayerSettings.volume
        : 1;
      let seekIndicatorTimeout = null;
      let hasStartedPlayback = false;
      let loadingStateTimeout = null;
      let previousVolumeBeforeMute = initialVolume > 0 ? initialVolume : 1;

      const updateVolumeSliderVisual = (volume) => {
        const percent = Math.max(0, Math.min(100, Math.round(volume * 100)));
        volumeSlider.style.setProperty("--k-volume-percent", `${percent}%`);
        volumeValue.textContent = `${percent}%`;
        volumeButton.innerHTML = getVolumeIcon(volume);
        volumeButton.setAttribute(
          "aria-label",
          percent === 0 ? "Unmute volume" : "Mute volume",
        );
        volumeWrap.dataset.muted = percent === 0 ? "true" : "false";
      };

      const applyVolume = (volume, { persist = true } = {}) => {
        const normalizedVolume = Math.max(0, Math.min(1, Number(volume) || 0));
        if (normalizedVolume > 0) previousVolumeBeforeMute = normalizedVolume;

        vid.muted = normalizedVolume === 0;
        vid.volume = normalizedVolume;
        volumeSlider.value = String(normalizedVolume);
        updateVolumeSliderVisual(normalizedVolume);

        if (persist) {
          savePlayerSettings(playerSettingsKey, { volume: normalizedVolume });
        }
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
          if (!vid.paused && !vid.ended) {
            loadingOverlay.classList.add("visible");
          }
        }, 250);
      };

      const showSeekIndicator = (direction) => {
        seekIndicator.innerHTML =
          direction === "forward" ? ICONS.forward : ICONS.backward;
        seekIndicator.dataset.direction = direction;
        seekIndicator.classList.remove("visible");
        void seekIndicator.offsetWidth;
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
      // Captured on pointerdown, before browsers fire their synthetic mouse
      // events after a tap — those would otherwise flip the state we compare
      // against in the click handler.
      let controlsShownAtGestureStart = false;
      let lastPointerType = "mouse";
      let touchMode = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;

      const setCenterSeekVisible = (visible) => {
        [btnSeekBack, btnSeekFwd].forEach((button) =>
          button.classList.toggle("visible", visible),
        );
      };

      // On touch the centre button rides with the overlay so there is always
      // something to tap to pause. With a mouse it keeps the old behaviour of
      // only appearing while paused.
      const syncBigButton = () => {
        btnBig.innerHTML = vid.paused ? ICONS.bigPlay : ICONS.bigPause;
        btnBig.classList.toggle(
          "visible",
          touchMode ? controlsShown || vid.paused : vid.paused,
        );
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
          // Anything that implies the user is still working the player keeps
          // the bar up: paused video, pointer parked on the controls, or an
          // open menu.
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
        vid.currentTime = Math.min(
          Math.max(vid.currentTime + seconds, 0),
          vid.duration,
        );
        showSeekIndicator(seconds > 0 ? "forward" : "backward");
        renderProgress(vid.currentTime);
        showControls();
      };

      [
        [btnSeekBack, -10],
        [btnSeekFwd, 10],
      ].forEach(([button, seconds]) => {
        button.addEventListener("click", (event) => {
          // The video element below has its own click-to-toggle-play handler.
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
        // Wrapped in arrows so `togglePlay` below is out of its temporal dead
        // zone by the time a key press actually fires these.
        applyVolume: (volume) => applyVolume(volume),
        togglePlay: () => togglePlay(),
      };
      bindGlobalPlayerListeners();

      applyVolume(initialVolume, { persist: false });

      getLatestReleaseInfo().then((release) => {
        if (!release || !btnUpdate?.isConnected) return;

        btnUpdate.style.display = "inline-flex";
        btnUpdate.title = `Update available: ${release.name || release.tagName}`;
        btnUpdate.addEventListener(
          "click",
          () => {
            window.open(release.htmlUrl, "_blank", "noopener,noreferrer");
          },
          { once: true },
        );
      });

      // ---- External player handoff -------------------------------------
      // `streamUrl` is the raw master playlist; `finalUrl` only differs by the
      // cache-busting query param the in-page player needs, so hand off the
      // clean one.
      populateExternalMenu(
        extMenu,
        buildExternalTargets(streamUrl, makeVideoTitle(result)),
        () => extWrap.classList.remove("open"),
      );

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
          applyVolume(
            previousVolumeBeforeMute > 0 ? previousVolumeBeforeMute : 1,
          );
          return;
        }

        previousVolumeBeforeMute =
          vid.volume > 0 ? vid.volume : previousVolumeBeforeMute;
        applyVolume(0);
      });

      chatController.connectVideo(vid);

      const togglePlay = () => {
        if (vid.paused) vid.play();
        else vid.pause();
      };
      // Touch taps only toggle the controls overlay, YouTube-style. Playback
      // is toggled by the play button. Mouse clicks keep click-to-play.
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
        if (Date.now() - lastSave > 4000) {
          localStorage.setItem(resumeKey, vid.currentTime);
          lastSave = Date.now();
        }

        if (isFinite(vid.duration) && !isScrubbing) {
          renderProgress(vid.currentTime);
        }
      });
      vid.addEventListener("ended", () => {
        localStorage.removeItem(resumeKey);
      });
      // Rendering the bar is split out so a seek can paint the new position
      // immediately instead of waiting for the next `timeupdate`, which does
      // not fire until the player has finished buffering the new spot.
      const renderProgress = (time) => {
        if (!isFinite(vid.duration)) return;
        progressBar.style.width = (time / vid.duration) * 100 + "%";
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
      // The video underneath toggles the overlay on tap; a scrub is not a tap.
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

      if (Hls.isSupported()) {
        const hls = new Hls({
          debug: false,
          enableWorker: false,
          lowLatencyMode: true,
        });
        activeHls = hls;
        hls.loadSource(finalUrl);
        hls.attachMedia(vid);
        hls.on(Hls.Events.MANIFEST_LOADING, () =>
          setLoadingState(true, { immediate: true }),
        );
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoadingState(false);
          const setQuality = (
            level,
            label,
            optionRef = null,
            qualitySettings = null,
          ) => {
            hls.currentLevel = level;
            qualBtn.textContent = `${label} ▴`;
            [...qualMenu.querySelectorAll(".k-quality-option")].forEach(
              (option) => option.classList.remove("active"),
            );
            if (optionRef) optionRef.classList.add("active");
            if (qualitySettings)
              savePlayerSettings(playerSettingsKey, {
                quality: qualitySettings,
              });
            qualWrap.classList.remove("open");
          };

          const addQualityItem = (
            level,
            label,
            qualitySettings,
            isActive = false,
          ) => {
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

          hls.levels
            .map((lvl, idx) => ({ lvl, idx }))
            .sort((a, b) => (b.lvl.height || 0) - (a.lvl.height || 0))
            .forEach(({ lvl, idx }) => {
              qualityItems.push({
                height: lvl.height,
                level: idx,
                label: `${lvl.height}p`,
                element: addQualityItem(idx, `${lvl.height}p`, {
                  mode: "manual",
                  height: lvl.height,
                }),
              });
            });

          const savedQuality = savedPlayerSettings.quality;
          if (savedQuality?.mode === "manual") {
            const matchedQuality = qualityItems.find(
              (item) => item.height === savedQuality.height,
            );
            if (matchedQuality) {
              setQuality(
                matchedQuality.level,
                matchedQuality.label,
                matchedQuality.element,
                { mode: "manual", height: matchedQuality.height },
              );
            } else {
              setQuality(-1, "Auto", autoItem, { mode: "auto" });
            }
          } else {
            setQuality(-1, "Auto", autoItem, { mode: "auto" });
          }

          vid.play().catch(() => btnBig.classList.add("visible"));
        });
        const savedTime = parseFloat(localStorage.getItem(resumeKey));

        if (Number.isFinite(savedTime) && savedTime > 1) {
          vid.addEventListener(
            "loadedmetadata",
            () => {
              if (Number.isFinite(vid.duration)) {
                vid.currentTime = Math.min(savedTime, vid.duration - 1);
              } else {
                vid.currentTime = savedTime;
              }
            },
            { once: true },
          );
        }

        hls.on(Hls.Events.ERROR, (e, data) => {
          if (data.fatal) setLoadingState(false);
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else if (data.type === Hls.ErrorTypes.MEDIA_ERROR)
              hls.recoverMediaError();
            else hls.destroy();
          }
        });
      } else if (vid.canPlayType("application/vnd.apple.mpegurl")) {
        vid.src = finalUrl;
      }
    } catch (e) {
      console.error(e);
      if (container) delete container.dataset.kickUnlockerProcessing;
    } finally {
      isUnlocking = false;
    }
  }

  const observer = new MutationObserver(() => {
    handleLocationChange();

    // React can rip our player out without any navigation event firing.
    if (activePlayerUi?.vid && !activePlayerUi.vid.isConnected) {
      destroyCustomPlayer();
    }

    const subscriberOverlay = document.querySelector(
      '[data-testid="video-subscriber-only"]',
    );

    ensureCopyUrlButton();

    if (subscriberOverlay) {
      const outerContainer = subscriberOverlay.closest(
        ".relative.flex.flex-col.items-center.justify-center.overflow-hidden.rounded",
      );
      if (
        outerContainer &&
        !(outerContainer as any).dataset.kickUnlockerProcessing &&
        !isUnlocking
      ) {
        unlockVideo(subscriberOverlay);
      }
      return;
    }

    ensureCustomPlayerToggle();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  ensureCustomPlayerToggle();
})();
