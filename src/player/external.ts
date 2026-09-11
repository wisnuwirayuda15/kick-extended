export function makeVideoTitle(result) {
  const raw = result?.video?.session_title || document.title || "kick-vod";
  return (
    raw
      .replace(/[\\/:*?"<>|]/g, "")
      .trim()
      .slice(0, 80) || "kick-vod"
  );
}

export function launchScheme(schemeUrl) {
  // A transient anchor lets the browser show its own "open app?" prompt
  // instead of treating this as a page navigation.
  const anchor = document.createElement("a");
  anchor.href = schemeUrl;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => anchor.remove(), 0);
}

export function downloadPlaylist(externalUrl, videoTitle) {
  const playlist = [
    "#EXTM3U",
    `#EXTINF:-1,${videoTitle}`,
    externalUrl,
    "",
  ].join("\n");
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

export function buildExternalTargets(externalUrl, videoTitle) {
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

export function populateExternalMenu(menuElement, targets, closeMenu) {
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
