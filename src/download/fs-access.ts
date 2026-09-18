// File System Access API access, and the one place that knows how to reach it.
//
// A multi-GB VOD cannot be accumulated in memory, so streaming to disk through
// showSaveFilePicker + a WritableStream is the only sink that works. The API is
// Chromium-desktop only: Firefox does not implement it and Safari does not
// either, so every caller must feature-detect rather than assume.
//
// Measured on Violentmonkey 2.49.0: Chrome exposes the method on the sandboxed
// `window`, so no @grant unsafeWindow is needed. The unsafeWindow arm is kept
// for managers whose proxy is less generous.

/**
 * Returns the object that owns showSaveFilePicker, or null.
 *
 * Deliberately returns the HOST rather than the method. Detaching it —
 * `const pick = window.showSaveFilePicker; pick(...)` — throws
 * "Illegal invocation", because the receiver is lost.
 */
export function getPickerHost() {
  if (typeof (window as any).showSaveFilePicker === "function") {
    return window as any;
  }
  const unsafe: any = typeof unsafeWindow !== "undefined" ? unsafeWindow : null;
  if (unsafe && typeof unsafe.showSaveFilePicker === "function") {
    return unsafe;
  }
  return null;
}

export function canStreamToDisk() {
  return getPickerHost() !== null;
}
