// Mutable state shared across module boundaries.
//
// destroyCustomPlayer writes six of these, and they belong to four different
// concerns (player, chat, native controls, auto-switch). If each one lived with
// its owner, teardown would have to import all four and all four would import
// teardown back. One module that everybody imports and nobody re-exports
// removes every one of those edges.
//
// This has to be an object rather than exported `let`s: ESM live bindings are
// read-only for importers, so `import { activeHls }` could not be assigned to.

export const state = {
  /** The hls.js instance driving the custom player, if one is mounted. */
  activeHls: null as any,

  /** Chat replay controller for the mounted player. */
  activeChatController: null as any,

  /** Cached resolved stream, shared by the copy-URL button and the native
   *  external-player dropdown so a second click does not re-resolve. */
  nativeExternalCache: null as any,

  /** Guards against re-entering unlockVideo while a mount is in flight. */
  isUnlocking: false,

  /** Handles the global keyboard shortcuts reach into. */
  activePlayerUi: null as any,

  /** Pending auto-switch settle timer. */
  autoSwitchTimer: null as any,
};
