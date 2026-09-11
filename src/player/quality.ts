import Hls from "hls.js";
import { readResumeTime, savePlayerSettings } from "../lib/storage.ts";
import { state } from "../state.ts";

/**
 * hls.js construction, the quality menu, saved-quality restore, resume seek
 * and fatal-error recovery. This is the contiguous tail of unlockVideo, moved
 * across unchanged, so the order of everything inside is preserved.
 *
 * Only two listeners live here; the other 42 are in controls.ts, and the
 * order they are registered in is observable behaviour.
 */
export function setupPlayback(
  { vid, btnBig, qualBtn, qualMenu, qualWrap, setLoadingState },
  { finalUrl, resumeKey, playerSettingsKey, savedPlayerSettings },
) {
  if (Hls.isSupported()) {
    const hls = new Hls({
      debug: false,
      enableWorker: false,
      lowLatencyMode: true,
    });
    state.activeHls = hls;
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
    const savedTime = parseFloat(readResumeTime(resumeKey));

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
}
