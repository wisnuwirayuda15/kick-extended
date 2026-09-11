// ==UserScript==
// @name         Kick Video Downloader Button
// @namespace    https://kick.com/
// @version      1.0.0
// @description  Adds a Download button to the Kick platform
// @match        https://kick.com/*
// @grant        none
// @run-at       document-idle
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMTYgMTYiPgoJPHBhdGggZD0iTTAgMGgxNnYxNkgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9IiM0Y2FmNTAiIGQ9Im02LjkyMiAzLjc2OGwtLjY0NC0uNTM2QTEgMSAwIDAgMCA1LjYzOCAzSDJhMSAxIDAgMCAwLTEgMXY4YTEgMSAwIDAgMCAxIDFoMTJhMSAxIDAgMCAwIDEtMVY1YTEgMSAwIDAgMC0xLTFINy41NjJhMSAxIDAgMCAxLS42NC0uMjMyIiAvPgoJPHBhdGggZmlsbD0iI2M4ZTZjOSIgZD0iTTEzIDV2M2gybC0zLjUgNEw4IDhoMlY1Wm0yIDh2MUg4di0xeiIgLz4KPC9zdmc+Cg==
// ==/UserScript==

(function () {
  "use strict";

  const BUTTON_ID = "km-download-btn";
  const THUMB_BTN_CLASS = "km-thumb-dl-btn";
  const VIDEO_PAGE_REGEX = /^\/[^/]+\/videos\/[^/]+\/?$/;
  const VIDEOS_LIST_REGEX = /^\/[^/]+\/videos\/?$/;

  const isVideoPage = () => VIDEO_PAGE_REGEX.test(window.location.pathname);
  const isVideosListPage = () => VIDEOS_LIST_REGEX.test(window.location.pathname);

  const buildDownloadUrl = (videoUrl) =>
    `https://kick-video.download/?download=${encodeURIComponent(videoUrl)}`;

  const createIcon = () => {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "1em");
    icon.setAttribute("height", "1em");
    icon.innerHTML =
      '<path d="M0 0h24v24H0z" fill="none"/>' +
      '<path fill="currentColor" d="M16.59 9H15V4c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v5H7.41c-.89 0-1.34 1.08-.71 1.71l4.59 4.59c.39.39 1.02.39 1.41 0l4.59-4.59c.63-.63.19-1.71-.7-1.71M5 19c0 .55.45 1 1 1h12c.55 0 1-.45 1-1s-.45-1-1-1H6c-.55 0-1 .45-1 1"/>';
    icon.style.flexShrink = "0";
    return icon;
  };

  // Hover CSS for thumbnail buttons (hidden by default, shown on thumbnail hover)
  const style = document.createElement("style");
  style.textContent = `
    .${THUMB_BTN_CLASS} {
      position: absolute;
      top: 6px;
      right: 6px;
      z-index: 10;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      font-size: 18px;
      color: #fff;
      background: rgba(0, 0, 0, 0.7);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s ease-out, background 0.15s ease-out;
    }
    a:hover > .${THUMB_BTN_CLASS},
    .${THUMB_BTN_CLASS}:focus-visible {
      opacity: 1;
    }
    .${THUMB_BTN_CLASS}:hover {
      background: rgba(0, 0, 0, 0.9);
    }
  `;
  document.head.appendChild(style);

  const findSubscribeButton = () => {
    const spans = document.querySelectorAll("button span");
    for (const span of spans) {
      if (span.textContent.trim() === "Subscribe") {
        return span.closest("button");
      }
    }
    return null;
  };

  const createDownloadButton = (referenceButton) => {
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;

    // Copy classes from the Subscribe button so it blends with Kick's UI
    btn.className = referenceButton.className;
    btn.style.marginLeft = "8px";

    // Download icon (SVG, left of the text)
    btn.appendChild(createIcon());

    const span = document.createElement("span");
    span.textContent = "Download";
    span.style.marginLeft = "6px";
    btn.appendChild(span);

    // Make sure icon + text align nicely regardless of Kick's button styles
    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(buildDownloadUrl(window.location.href), "_blank", "noopener");
    });

    return btn;
  };

  const injectButton = () => {
    if (!isVideoPage()) {
      // Clean up if user navigated away (SPA navigation)
      document.getElementById(BUTTON_ID)?.remove();
      return;
    }

    if (document.getElementById(BUTTON_ID)) return; // already injected

    const subscribeBtn = findSubscribeButton();
    if (!subscribeBtn) return;

    const downloadBtn = createDownloadButton(subscribeBtn);
    subscribeBtn.insertAdjacentElement("afterend", downloadBtn);
  };

  const injectThumbnailButtons = () => {
    // if (!isVideosListPage()) return;

    // Video thumbnails are <a href="/{user}/videos/{id}"> cards
    const anchors = document.querySelectorAll('a[href*="/videos/"]');
    for (const anchor of anchors) {
      if (anchor.dataset.kmDlInjected) continue;

      const href = anchor.getAttribute("href");
      if (!href || !VIDEO_PAGE_REGEX.test(href)) continue;

      // Only target thumbnail cards (they contain the video thumbnail image)
      if (!anchor.querySelector("img[data-thumbnail], img")) continue;

      anchor.dataset.kmDlInjected = "true";

      const btn = document.createElement("button");
      btn.className = THUMB_BTN_CLASS;
      btn.title = "Download video";
      btn.appendChild(createIcon());

      const videoUrl = new URL(href, window.location.origin).href;
      btn.addEventListener("click", (e) => {
        // Stop the click from triggering the anchor navigation
        e.preventDefault();
        e.stopPropagation();
        window.open(buildDownloadUrl(videoUrl), "_blank", "noopener");
      });

      anchor.appendChild(btn);
    }
  };

  const runInjections = () => {
    injectButton();
    injectThumbnailButtons();
  };

  // Kick is an SPA — watch for DOM changes and route changes
  const observer = new MutationObserver(() => runInjections());
  observer.observe(document.body, { childList: true, subtree: true });

  // Also hook history API for instant reaction to route changes
  const patchHistory = (method) => {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      setTimeout(runInjections, 100);
      return result;
    };
  };
  patchHistory("pushState");
  patchHistory("replaceState");
  window.addEventListener("popstate", () => setTimeout(runInjections, 100));

  // Initial run
  runInjections();
})();
