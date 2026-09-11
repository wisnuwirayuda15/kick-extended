import { ICONS } from "../icons.ts";

export function formatTime(seconds) {
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

export function getVolumeIcon(volume) {
  if (volume <= 0) return ICONS.volumeMute;
  if (volume < 0.2) return ICONS.volumeLow;
  if (volume < 0.5) return ICONS.volumeMedium;
  return ICONS.volumeHigh;
}
