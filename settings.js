/* =========================================================================
   settings.js
   Defaults (including the colleague roster) persist via Storage
   (IndexedDB). A cached copy is kept in memory so the rest of the app
   (e.g. New Kaizen pre-fill) can read defaults synchronously without
   awaiting a DB round-trip on every call.
   Call Settings.load() once at startup before relying on getDefaults().
   ========================================================================= */

const Settings = (function () {
  "use strict";

  /** @type {{name:string, department:string, depot:string, company:string, apiKey:string, aiModel:string, colleagues:string[]}} */
  let cache = {
    name: "",
    department: "",
    depot: "",
    company: "GCMMF Ltd., Anand",
    apiKey: "",
    aiModel: "claude-haiku-4-5-20251001",
    colleagues: [],
  };

  /** Loads defaults from IndexedDB into the in-memory cache. Call at startup. */
  function load() {
    return Storage.getSettings().then((saved) => {
      if (saved) cache = Object.assign({}, cache, saved);
      if (!Array.isArray(cache.colleagues)) cache.colleagues = [];
      return getDefaults();
    });
  }

  function getDefaults() {
    return Object.assign({}, cache, { colleagues: cache.colleagues.slice() });
  }

  function saveDefaults(newDefaults) {
    cache = Object.assign({}, cache, newDefaults);
    return Storage.saveSettings(cache).then(() => getDefaults());
  }

  /** Fills the Settings form inputs from the current cached defaults. */
  function populateForm() {
    document.getElementById("stName").value = cache.name;
    document.getElementById("stDepartment").value = cache.department;
    document.getElementById("stDepot").value = cache.depot;
    document.getElementById("stCompany").value = cache.company;
    document.getElementById("stApiKey").value = cache.apiKey;
    document.getElementById("stAiModel").value = cache.aiModel;
    renderColleagueList();
  }

  // ---------------------------- Colleague roster ----------------------------

  function getColleagues() {
    return cache.colleagues.slice();
  }

  function addColleague(name) {
    name = (name || "").trim();
    if (!name) return Promise.resolve(getColleagues());
    if (cache.colleagues.some((c) => c.toLowerCase() === name.toLowerCase())) {
      return Promise.resolve(getColleagues());
    }
    cache.colleagues.push(name);
    return Storage.saveSettings(cache).then(() => getColleagues());
  }

  function removeColleague(name) {
    cache.colleagues = cache.colleagues.filter((c) => c !== name);
    return Storage.saveSettings(cache).then(() => getColleagues());
  }

  /** Renders the colleague list in Settings with a delete button on each. */
  function renderColleagueList() {
    const host = document.getElementById("colleagueList");
    if (!host) return;
    host.innerHTML = "";

    if (cache.colleagues.length === 0) {
      host.innerHTML = '<div class="text-muted small">No colleagues added yet.</div>';
      return;
    }

    cache.colleagues.forEach((name) => {
      const row = document.createElement("div");
      row.className = "colleague-row";
      row.innerHTML =
        "<span>" + escapeHtml(name) + "</span>" +
        '<button type="button" class="btn btn-sm btn-link text-danger" title="Remove">✕</button>';
      row.querySelector("button").addEventListener("click", () => {
        removeColleague(name).then(() => {
          renderColleagueList();
          window.dispatchEvent(new CustomEvent("colleagues-changed"));
        });
      });
      host.appendChild(row);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  return {
    load: load,
    getDefaults: getDefaults,
    saveDefaults: saveDefaults,
    populateForm: populateForm,
    getColleagues: getColleagues,
    addColleague: addColleague,
    removeColleague: removeColleague,
    renderColleagueList: renderColleagueList,
  };
})();
