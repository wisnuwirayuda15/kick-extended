/**
 * Download arrow, shared by the VOD page button and the thumbnail buttons.
 *
 * Built as a real element rather than an ICONS markup string because both
 * callers append it to a button they have already constructed.
 */
export function createDownloadIcon() {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "1em");
  icon.setAttribute("height", "1em");
  icon.innerHTML =
    '<path d="M0 0h24v24H0z" fill="none"/>' +
    '<path fill="currentColor" d="M16.59 9H15V4c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v5H7.41c-.89 0-1.34 1.08-.71 1.71l4.59 4.59c.39.39 1.02.39 1.41 0l4.59-4.59c.63-.63.19-1.71-.7-1.71M5 19c0 .55.45 1 1 1h12c.55 0 1-.45 1-1s-.45-1-1-1H6c-.55 0-1 .45-1 1"/>';
  icon.style.flexShrink = "0";
  return icon;
}
