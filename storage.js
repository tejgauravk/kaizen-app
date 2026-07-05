/* =========================================================================
   storage.js
   Server-backed storage via Cloudflare Pages Functions + D1 (see
   /functions/api/*.js and schema.sql). All data — Kaizens and Settings —
   now lives in one shared database, not per-browser, so it's the same on
   every device that opens this site.

   This file exposes the exact same public API it always has
   (init/saveKaizen/getAllKaizens/getKaizen/deleteKaizen/saveSettings/
   getSettings, all Promise-based) — that's deliberate. Every other file
   in this app (app.js, register.js, settings.js) only ever talks to that
   API, never to IndexedDB or fetch() directly, so swapping what's behind
   it didn't require touching them at all.

   No login: these endpoints have no authentication check. Protection is
   purely "don't let this URL leak" — see the deployment notes for why
   that's an intentional tradeoff, not an oversight.
   ========================================================================= */

const Storage = (function () {
  "use strict";

  /** No local database to open anymore — kept for API compatibility with callers. */
  function init() {
    return Promise.resolve();
  }

  function handleResponse(res, errorMessage) {
    if (!res.ok) {
      return res.text().then((text) => {
        throw new Error(errorMessage + " (server responded " + res.status + ")" + (text ? ": " + text : ""));
      });
    }
    return res.json();
  }

  // ---------------------------- Kaizens ----------------------------

  function saveKaizen(kaizen) {
    const isUpdate = !!kaizen.id;
    const url = isUpdate ? "/api/kaizens/" + kaizen.id : "/api/kaizens";
    return fetch(url, {
      method: isUpdate ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(kaizen),
    })
      .then((res) => handleResponse(res, "Could not save Kaizen"))
      .then((data) => data.id);
  }

  function getAllKaizens() {
    return fetch("/api/kaizens").then((res) => handleResponse(res, "Could not load Kaizens"));
  }

  function getKaizen(id) {
    return fetch("/api/kaizens/" + id).then((res) => {
      if (res.status === 404) return null;
      return handleResponse(res, "Could not load Kaizen #" + id);
    });
  }

  function deleteKaizen(id) {
    return fetch("/api/kaizens/" + id, { method: "DELETE" }).then((res) =>
      handleResponse(res, "Could not delete Kaizen #" + id)
    );
  }

  // ---------------------------- Settings ----------------------------

  function saveSettings(defaults) {
    return fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(defaults),
    }).then((res) => handleResponse(res, "Could not save settings"));
  }

  function getSettings() {
    return fetch("/api/settings").then((res) => handleResponse(res, "Could not load settings"));
  }

  return {
    init: init,
    saveKaizen: saveKaizen,
    getAllKaizens: getAllKaizens,
    getKaizen: getKaizen,
    deleteKaizen: deleteKaizen,
    saveSettings: saveSettings,
    getSettings: getSettings,
  };
})();
