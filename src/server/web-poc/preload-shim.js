/**
 * preload-shim.js — Web port of the Electron preload.js (contextBridge).
 *
 * The Antigravity UI is a sandboxed web page (nodeIntegration:false,
 * contextIsolation:true) whose ONLY native dependency is the set of
 * `window.electron*` globals injected by Electron's preload.js.
 *
 * This file recreates those globals with browser-native equivalents so the
 * UNMODIFIED 本家 UI can run in a plain browser. The reverse proxy injects
 * this as the first <script> in <head>, so it runs before the app bundle.
 *
 * Source of truth: temp_app_asar/dist/preload.js
 */
(function () {
  "use strict";

  var LOG = function () {
    try { console.debug.apply(console, ["[ag-shim]"].concat([].slice.call(arguments))); } catch (e) {}
  };
  LOG("installing web shims");

  // Tiny pub/sub helper -> returns an unsubscribe fn like the originals.
  function subscribe(set, cb) {
    set.add(cb);
    return function () { set.delete(cb); };
  }

  // ---------------------------------------------------------------------------
  // electronUpdater — no auto-update on web. Report "no updates" / no-op.
  // ---------------------------------------------------------------------------
  var updaterListeners = new Set();
  window.electronUpdater = {
    onStateChanged: function (cb) { return subscribe(updaterListeners, cb); },
    applyUpdate: function () { return Promise.resolve(); },
    quitAndInstall: function () { return Promise.resolve(); },
    checkForUpdates: function () { return Promise.resolve(); },
  };

  // ---------------------------------------------------------------------------
  // dialog.showOpenDialog — pick a workspace folder.
  // A browser cannot return a SERVER filesystem path. For the PoC we prompt the
  // user to type an absolute path on the server. (Real impl: server-side dir browser.)
  // ---------------------------------------------------------------------------
  window.dialog = {
    showOpenDialog: function () {
      var p = window.prompt(
        "Open workspace — enter an ABSOLUTE path on the SERVER:",
        ""
      );
      return Promise.resolve(p ? p.trim() || undefined : undefined);
    },
  };

  // ---------------------------------------------------------------------------
  // nativeNotifications — Web Notification API.
  // ---------------------------------------------------------------------------
  var notifClickListeners = new Set();
  function fireNotifClick(payload) {
    notifClickListeners.forEach(function (cb) { try { cb(payload); } catch (e) {} });
  }
  window.nativeNotifications = {
    send: function (options) {
      options = options || {};
      function show() {
        try {
          var n = new Notification(options.title || "Antigravity", {
            body: options.body,
            silent: options.silent,
          });
          n.onclick = function () {
            window.focus();
            if (options.payload !== undefined) fireNotifClick(options.payload);
          };
        } catch (e) { LOG("Notification failed", e); }
      }
      if ("Notification" in window) {
        if (Notification.permission === "granted") { show(); }
        else if (Notification.permission !== "denied") {
          Notification.requestPermission().then(function (perm) {
            if (perm === "granted") show();
          });
        }
      }
      return Promise.resolve();
    },
    openSystemPreferences: function () { return Promise.resolve(); },
    onClicked: function (cb) { return subscribe(notifClickListeners, cb); },
  };

  // ---------------------------------------------------------------------------
  // nativeStorage — persistent key/value, backed by localStorage.
  // Shape: getItems() -> { [key]: value }; updateItems(changes) merges/deletes.
  // ---------------------------------------------------------------------------
  var STORAGE_KEY = "__ag_native_storage__";
  var storageChangeListeners = new Set();
  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function writeStore(obj) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }
  window.nativeStorage = {
    getItems: function () { return Promise.resolve(readStore()); },
    updateItems: function (changes) {
      var store = readStore();
      var applied = {};
      Object.keys(changes || {}).forEach(function (k) {
        var v = changes[k];
        if (v === null || v === undefined) { delete store[k]; }
        else { store[k] = v; }
        applied[k] = v;
      });
      writeStore(store);
      storageChangeListeners.forEach(function (cb) { try { cb(applied); } catch (e) {} });
      return Promise.resolve();
    },
    onChanged: function (cb) { return subscribe(storageChangeListeners, cb); },
  };
  // Cross-tab sync
  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY) {
      storageChangeListeners.forEach(function (cb) { try { cb(readStore()); } catch (err) {} });
    }
  });

  // ---------------------------------------------------------------------------
  // logs — return empty; server logs aren't exposed to the browser in the PoC.
  // ---------------------------------------------------------------------------
  window.logs = {
    getElectronLogs: function () { return Promise.resolve(""); },
  };

  // ---------------------------------------------------------------------------
  // extensions — sidecar UI extensions used the plugin:// scheme proxy.
  // No-op in the PoC: panels backed by sidecar extensions may not render.
  // ---------------------------------------------------------------------------
  window.extensions = {
    sendAuthorities: function () { return Promise.resolve(); },
  };

  // ---------------------------------------------------------------------------
  // deepLink — antigravity:// deep links. Surface any ?deep_link= query param.
  // ---------------------------------------------------------------------------
  var deepLinkListeners = new Set();
  var storedDeepLink = (function () {
    try { return new URLSearchParams(location.search).get("deep_link"); }
    catch (e) { return null; }
  })();
  window.deepLink = {
    onDeepLink: function (cb) { return subscribe(deepLinkListeners, cb); },
    getStoredDeepLink: function () {
      var l = storedDeepLink; storedDeepLink = null; return Promise.resolve(l);
    },
  };

  // ---------------------------------------------------------------------------
  // agent — tray "active agent count". No tray on web.
  // ---------------------------------------------------------------------------
  window.agent = {
    updateActiveAgentCount: function () { return Promise.resolve(); },
  };

  // ---------------------------------------------------------------------------
  // electronNative — window chrome / zoom / external links.
  // Window controls are no-ops; openExternal uses window.open.
  // ---------------------------------------------------------------------------
  window.electronNative = {
    getZoomLevel: function () { return 0; },
    setTitleBarOverlay: function () { return Promise.resolve(); },
    minimize: function () { return Promise.resolve(); },
    maximize: function () { return Promise.resolve(); },
    unmaximize: function () { return Promise.resolve(); },
    isMaximized: function () { return Promise.resolve(false); },
    close: function () { return Promise.resolve(); },
    toggleDevTools: function () { return Promise.resolve(); },
    zoomIn: function () {},
    zoomOut: function () {},
    resetZoom: function () {},
    openExternal: function (url) {
      try { window.open(url, "_blank", "noopener,noreferrer"); } catch (e) {}
      return Promise.resolve();
    },
  };

  // ---------------------------------------------------------------------------
  // ide — whether the standalone IDE is installed. Always false on web.
  // ---------------------------------------------------------------------------
  window.ide = {
    isInstalled: function () { return Promise.resolve(false); },
  };

  LOG("web shims installed");
})();
