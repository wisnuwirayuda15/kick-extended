import { getSpaDisabled, setSpaDisabled } from "../lib/storage.ts";
import { showToast } from "../lib/toast.ts";

// Optional: turn Kick's client-side routing into ordinary page loads.
//
// Every in-site link then reloads the page, so each VOD starts from a fresh
// document instead of whatever React leaves behind, at the cost of Kick's
// instant page switches. The setting is read at the moment of each click, so
// toggling it takes effect without a reload.

/** The URL a click should hard-navigate to, or null to leave it to Kick. */
function hardNavigationTarget(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return null;
  // Modified clicks already bypass the router: new tab, new window, download.
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
    return null;
  }

  // A button inside a link card (the thumbnail download button) is its own
  // control, not the link.
  const target = event.target as Element;
  const control = target?.closest?.("a[href], button");
  if (!control || control.tagName !== "A") return null;

  const anchor = control as HTMLAnchorElement;
  if (anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target !== "_self") return null;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Same page, or only a #fragment away: nothing to load.
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    return null;
  }
  return url.href;
}

export function installSpaBlocker() {
  // Capture on window runs before React's listeners on its root, so Kick's
  // router never sees the click.
  window.addEventListener(
    "click",
    (event) => {
      if (!getSpaDisabled()) return;
      const href = hardNavigationTarget(event);
      if (!href) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(href);
    },
    true,
  );
}

/**
 * Safety net for navigations that are not link clicks (search results,
 * router.push from a button). Called from the history patch in main.ts with
 * the URL Kick is about to push; true means the push was turned into a load.
 */
export function interceptPushState(url: unknown) {
  if (!getSpaDisabled() || url == null) return false;
  const next = new URL(String(url), window.location.href);
  if (next.pathname === window.location.pathname) return false;
  window.location.assign(next.href);
  return true;
}

// Greasemonkey 4 has no synchronous menu API, so there is simply no toggle
// there rather than a crash.
let menuCommandId: any = null;

export function registerSpaMenuCommand() {
  if (typeof GM_registerMenuCommand !== "function") return;
  if (menuCommandId !== null && typeof GM_unregisterMenuCommand === "function")
    GM_unregisterMenuCommand(menuCommandId);

  const label = getSpaDisabled()
    ? "SPA navigation: off (click to turn on)"
    : "SPA navigation: on (click to turn off)";

  menuCommandId = GM_registerMenuCommand(label, () => {
    const disabled = !getSpaDisabled();
    setSpaDisabled(disabled);
    showToast(
      disabled
        ? "Kick Extended: SPA navigation off. Links now load a fresh page."
        : "Kick Extended: SPA navigation on.",
    );
    registerSpaMenuCommand();
  });
}
