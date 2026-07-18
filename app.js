/* =========================================================================
   app.js
   Phase 2 — Build UI: page navigation, form wiring, and the in-memory
   hand-off of a draft Kaizen from "New Kaizen" to "Edit Kaizen".

   Persistence (storage.js / register.js / settings.js) and real Word
   export (export.js) and AI (ai.js) are stubbed for now and will be
   filled in during Phases 3–5. This file only depends on the small
   stub APIs those modules already expose, so nothing here should need
   to change when the stubs become real implementations.
   ========================================================================= */

(function () {
  "use strict";

  const PAGES = ["home", "dashboard", "new-kaizen", "edit-kaizen", "register", "ai", "settings"];

  /** Holds the Kaizen currently open in the Edit screen (draft or saved). */
  let currentKaizen = null;

  // ------------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------------

  function showPage(pageId) {
    if (!PAGES.includes(pageId)) pageId = "home";

    PAGES.forEach((id) => {
      const el = document.getElementById("page-" + id);
      if (el) el.classList.toggle("d-none", id !== pageId);
    });

    document.querySelectorAll(".navbar-nav .nav-link").forEach((link) => {
      link.classList.toggle("active", link.dataset.nav === pageId);
    });

    if (pageId === "register") {
      Register.render();
    }
    if (pageId === "dashboard") {
      Dashboard.render();
    }
    if (pageId === "settings") {
      Settings.populateForm();
    }
    if (pageId === "new-kaizen") {
      prefillNewKaizenFromDefaults();
      renderColleagueCheckboxes();
      const banner = document.getElementById("nkNoApiKeyWarning");
      banner.classList.toggle("d-none", AI.isConfigured());
    }
    if (pageId === "ai") {
      document.getElementById("aiNoApiKeyWarning").classList.toggle("d-none", AI.isConfigured());
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function wireNavigation() {
    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        showPage(el.dataset.nav);
      });
    });
  }

  // ------------------------------------------------------------------
  // Toasts
  // ------------------------------------------------------------------

  function showToast(message, variant) {
    // Defensive on purpose: this is a "fire and forget" notification. If it
    // throws (e.g. Bootstrap hasn't finished loading from its CDN yet),
    // that must never break the caller's own logic that runs after it —
    // callers often do real work (like refreshing data) right after
    // showing a toast, and a UI notification failing is not a reason for
    // that work to silently never happen.
    try {
      variant = variant || "primary";
      const host = document.getElementById("toastHost");
      const toastEl = document.createElement("div");
      toastEl.className = "toast align-items-center text-bg-" + variant + " border-0";
      toastEl.setAttribute("role", "alert");
      toastEl.innerHTML =
        '<div class="d-flex">' +
        '<div class="toast-body">' + message + "</div>" +
        '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>' +
        "</div>";
      host.appendChild(toastEl);
      const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
      toast.show();
      toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
    } catch (err) {
      console.error("showToast failed (message was: " + message + "):", err);
    }
  }
  window.showToast = showToast;

  // ------------------------------------------------------------------
  // New Kaizen -> AI stub -> Edit Kaizen hand-off
  // ------------------------------------------------------------------

  function prefillNewKaizenFromDefaults() {
    const defaults = Settings.getDefaults();
    if (!defaults) return;
    setValueIfEmpty("nkName", defaults.name);
    setValueIfEmpty("nkDepartment", defaults.department);
    setValueIfEmpty("nkDepot", defaults.depot);
    if (!document.getElementById("nkMonth").value) {
      document.getElementById("nkMonth").value = currentMonthLabel();
    }
  }

  function setValueIfEmpty(id, value) {
    const el = document.getElementById(id);
    if (el && !el.value && value) el.value = value;
  }

  function currentMonthLabel() {
    return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  /** Rebuilds the "Colleagues involved" checkboxes from Settings' current roster. */
  function renderColleagueCheckboxes() {
    const host = document.getElementById("nkColleagueCheckboxes");
    const colleagues = Settings.getColleagues();

    if (colleagues.length === 0) {
      host.innerHTML = '<div class="text-muted small">No colleagues added yet — add them in <a href="#" id="nkGoToSettingsLink">Settings</a>.</div>';
      document.getElementById("nkGoToSettingsLink").addEventListener("click", (e) => {
        e.preventDefault();
        showPage("settings");
      });
      return;
    }

    host.innerHTML = colleagues
      .map((name, i) => {
        const id = "nkColleague" + i;
        return (
          '<div class="form-check"><input class="form-check-input" type="checkbox" value="' +
          name.replace(/"/g, "&quot;") + '" id="' + id + '">' +
          '<label class="form-check-label" for="' + id + '">' + name + "</label></div>"
        );
      })
      .join("");
  }

  /** Merges ticked colleague checkboxes into the free-typed Name(s) value, without duplicating. */
  /** Merges a list of checked colleague names into a free-typed name string, without duplicating. */
  function combineNames(freeTypedNames, checkedNames) {
    const existing = (freeTypedNames || "").split(",").map((s) => s.trim()).filter(Boolean);
    (checkedNames || []).forEach((name) => {
      if (!existing.some((e) => e.toLowerCase() === name.toLowerCase())) existing.push(name);
    });
    return existing.join(", ");
  }

  function combineNamesWithColleagues(freeTypedNames) {
    const checked = Array.from(document.querySelectorAll("#nkColleagueCheckboxes input:checked")).map((cb) => cb.value);
    return combineNames(freeTypedNames, checked);
  }

  /** Puts a button into/out of a disabled "working" state with a temporary label. */
  function setButtonBusy(btn, busy, busyLabel) {
    if (busy) {
      btn.dataset.originalLabel = btn.dataset.originalLabel || btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>' + busyLabel;
    } else {
      btn.disabled = false;
      if (btn.dataset.originalLabel) btn.innerHTML = btn.dataset.originalLabel;
    }
  }

  function wireNewKaizenForm() {
    const form = document.getElementById("newKaizenForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const actionTaken = document.getElementById("nkActionTaken").value.trim();
      if (!actionTaken) {
        form.classList.add("was-validated");
        document.getElementById("nkActionTaken").focus();
        return;
      }

      const meta = {
        name: combineNamesWithColleagues(document.getElementById("nkName").value.trim()),
        department: document.getElementById("nkDepartment").value.trim(),
        month: document.getElementById("nkMonth").value.trim() || currentMonthLabel(),
        depot: document.getElementById("nkDepot").value.trim(),
      };

      const submitBtn = form.querySelector('button[type="submit"]');
      const usingAI = AI.isConfigured();
      setButtonBusy(submitBtn, true, usingAI ? "Asking Claude…" : "Drafting…");

      AI.generateKaizen(actionTaken, meta)
        .then((generated) => {
          currentKaizen = Object.assign(
            { id: null, createdDate: new Date().toISOString() },
            meta,
            generated
          );
          loadKaizenIntoEditForm(currentKaizen);
          form.reset();
          form.classList.remove("was-validated");
          showPage("edit-kaizen");
          showToast(
            usingAI ? "Generated with Claude." : "Offline draft created — fill in the bracketed prompts, or add an API key in Settings for AI writing.",
            usingAI ? "success" : "info"
          );
        })
        .catch((err) => {
          showToast(err.message, "danger");
        })
        .finally(() => {
          setButtonBusy(submitBtn, false);
        });
    });
  }

  // ------------------------------------------------------------------
  // Edit Kaizen screen
  // ------------------------------------------------------------------

  /** Opens an existing (saved) Kaizen in the Edit screen. Used by register.js. */
  function openKaizenForEdit(k) {
    currentKaizen = k;
    loadKaizenIntoEditForm(k);
    showPage("edit-kaizen");
  }

  /** Accepts either the old single-string format or the new array format, always returns an array. */
  function toAreaArray(value) {
    if (Array.isArray(value)) return value;
    if (value) return [value];
    return [];
  }

  function setCheckedValues(groupId, values) {
    const set = new Set(values || []);
    document.querySelectorAll("#" + groupId + " input[type=checkbox]").forEach((cb) => {
      cb.checked = set.has(cb.value);
    });
  }

  function getCheckedValues(groupId) {
    return Array.from(document.querySelectorAll("#" + groupId + " input[type=checkbox]:checked")).map((cb) => cb.value);
  }

  function loadKaizenIntoEditForm(k) {
    document.getElementById("ekId").value = k.id || "";
    document.getElementById("ekTitle").value = k.title || "";
    document.getElementById("ekBefore").value = k.before || "";
    document.getElementById("ekProblem").value = k.problem || "";
    document.getElementById("ekActionTaken").value = k.improvedActionTaken || k.actionTaken || "";
    document.getElementById("ekAfter").value = k.after || "";
    document.getElementById("ekBenefits").value = k.benefits || "";
    setCheckedValues("ekWorkAreaGroup", toAreaArray(k.workArea));
    setCheckedValues("ekTqmAreaGroup", toAreaArray(k.tqmArea));
    document.getElementById("ekName").value = k.name || "";
    document.getElementById("ekDepartment").value = k.department || "";
    document.getElementById("ekMonth").value = k.month || "";
    document.getElementById("ekDepot").value = k.depot || "";
  }

  function readKaizenFromEditForm() {
    return {
      id: document.getElementById("ekId").value || null,
      title: document.getElementById("ekTitle").value.trim(),
      before: document.getElementById("ekBefore").value.trim(),
      problem: document.getElementById("ekProblem").value.trim(),
      actionTaken: document.getElementById("ekActionTaken").value.trim(),
      after: document.getElementById("ekAfter").value.trim(),
      benefits: document.getElementById("ekBenefits").value.trim(),
      workArea: getCheckedValues("ekWorkAreaGroup"),
      tqmArea: getCheckedValues("ekTqmAreaGroup"),
      name: document.getElementById("ekName").value.trim(),
      department: document.getElementById("ekDepartment").value.trim(),
      month: document.getElementById("ekMonth").value.trim(),
      depot: document.getElementById("ekDepot").value.trim(),
      createdDate: (currentKaizen && currentKaizen.createdDate) || new Date().toISOString(),
    };
  }

  function wireEditKaizenButtons() {
    const improveBtn = document.getElementById("btnImproveAI");
    improveBtn.addEventListener("click", () => {
      const draft = readKaizenFromEditForm();
      const usingAI = AI.isConfigured();
      setButtonBusy(improveBtn, true, usingAI ? "Improving…" : "Tidying…");
      AI.improveKaizen(draft)
        .then((improved) => {
          loadKaizenIntoEditForm(Object.assign(draft, improved));
          showToast(
            usingAI ? "AI suggestions applied." : "Basic offline cleanup applied — add an API key in Settings for real AI improvement.",
            usingAI ? "success" : "info"
          );
        })
        .catch((err) => showToast(err.message, "danger"))
        .finally(() => setButtonBusy(improveBtn, false));
    });

    document.getElementById("btnSaveKaizen").addEventListener("click", () => {
      const form = document.getElementById("editKaizenForm");
      if (!document.getElementById("ekActionTaken").value.trim()) {
        form.classList.add("was-validated");
        document.getElementById("ekActionTaken").focus();
        return;
      }
      const kaizen = readKaizenFromEditForm();
      Storage.saveKaizen(kaizen)
        .then((id) => {
          kaizen.id = id;
          currentKaizen = kaizen;
          document.getElementById("ekId").value = id;
          showToast("Kaizen saved to the Register.", "success");
        })
        .catch((err) => showToast(err.message, "danger"));
    });

    document.getElementById("btnExportWord").addEventListener("click", () => {
      const kaizen = readKaizenFromEditForm();
      Export.exportKaizenToWord(kaizen);
    });

    document.getElementById("btnPrintKaizen").addEventListener("click", () => {
      window.print();
    });

    document.getElementById("btnEmailKaizen").addEventListener("click", () => {
      openEmailModal(readKaizenFromEditForm());
    });
  }

  // ------------------------------------------------------------------
  // Email This Kaizen — downloads the .docx and opens a pre-filled mailto
  // link, plus records the attempt in the shared email log. Free, no
  // account needed; true auto-attach requires a real email API + a domain
  // the person owns, so this is the practical version until then.
  // ------------------------------------------------------------------

  let pendingEmailKaizen = null;

  function openEmailModal(kaizen) {
    pendingEmailKaizen = kaizen;
    document.getElementById("emailRecipient").value = "";
    new bootstrap.Modal(document.getElementById("emailModal")).show();
  }

  function wireEmailModal() {
    document.getElementById("btnConfirmEmail").addEventListener("click", () => {
      const recipient = document.getElementById("emailRecipient").value.trim();
      if (!recipient) {
        showToast("Enter a recipient email address first.", "warning");
        return;
      }
      if (!pendingEmailKaizen) return;

      Export.exportKaizenToWord(pendingEmailKaizen);

      Storage.logEmail({
        kaizenId: pendingEmailKaizen.id || null,
        kaizenTitle: pendingEmailKaizen.title || "",
        recipient: recipient,
      }).catch((err) => console.error("Could not record email log:", err));

      const subject = encodeURIComponent("Kaizen: " + (pendingEmailKaizen.title || "Untitled"));
      const body = encodeURIComponent(
        "Hi,\n\nPlease find the attached Kaizen record: " + (pendingEmailKaizen.title || "") + ".\n\n" +
        "(The Word file just downloaded to your computer — attach it here before sending.)\n\nThanks."
      );
      window.location.href = "mailto:" + encodeURIComponent(recipient) + "?subject=" + subject + "&body=" + body;

      bootstrap.Modal.getInstance(document.getElementById("emailModal")).hide();
      showToast("File downloading — attach it in the email window that just opened.", "info");
    });
  }

  // ------------------------------------------------------------------
  // Settings screen
  // ------------------------------------------------------------------

  function wireSettingsForm() {
    document.getElementById("settingsForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const defaults = {
        name: document.getElementById("stName").value.trim(),
        department: document.getElementById("stDepartment").value.trim(),
        depot: document.getElementById("stDepot").value.trim(),
        company: document.getElementById("stCompany").value.trim(),
        apiKey: document.getElementById("stApiKey").value.trim(),
        aiModel: document.getElementById("stAiModel").value,
      };
      Settings.saveDefaults(defaults);
      showToast("Defaults saved.", "success");
    });

    function addColleagueFromInput() {
      const input = document.getElementById("stNewColleague");
      const name = input.value.trim();
      if (!name) return;
      Settings.addColleague(name).then(() => {
        Settings.renderColleagueList();
        input.value = "";
        input.focus();
      });
    }

    document.getElementById("btnAddColleague").addEventListener("click", addColleagueFromInput);
    document.getElementById("stNewColleague").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addColleagueFromInput();
      }
    });
  }

  // ------------------------------------------------------------------
  // AI Suggestion Centre — paste-text analysis (file upload not yet wired)
  // ------------------------------------------------------------------

  /** Suggestions from the last analysis, kept so the batch-create button can look up full details by index. */
  let currentSuggestions = [];

  function renderSuggestions(suggestions) {
    currentSuggestions = suggestions;
    const host = document.getElementById("aiSuggestionResults");
    host.innerHTML = "";

    if (suggestions.length === 0) {
      host.innerHTML = '<div class="text-muted">No clear Kaizen opportunities found in that text — try pasting something more specific.</div>';
      document.getElementById("aiBatchBar").classList.add("d-none");
      return;
    }

    suggestions.forEach((s, i) => {
      const card = document.createElement("div");
      card.className = "suggestion-card";
      const colleagues = Settings.getColleagues();
      const colleagueHtml = colleagues.length
        ? '<div class="mb-2"><span class="text-muted small d-block mb-1">Colleagues involved:</span>' +
          colleagues.map((name, j) => {
            const id = "sugColleague" + i + "_" + j;
            return (
              '<div class="form-check form-check-inline">' +
              '<input class="form-check-input suggestion-colleague" type="checkbox" value="' + escapeHtml(name) + '" id="' + id + '" data-suggestion-index="' + i + '">' +
              '<label class="form-check-label small" for="' + id + '">' + escapeHtml(name) + "</label></div>"
            );
          }).join("") +
          "</div>"
        : "";
      card.innerHTML =
        '<div class="form-check mb-2">' +
        '<input class="form-check-input suggestion-check" type="checkbox" checked id="sugCheck' + i + '">' +
        '<label class="form-check-label fw-bold" for="sugCheck' + i + '" style="color:var(--blue-900);">' + escapeHtml(s.title || "Untitled idea") + "</label>" +
        "</div>" +
        "<p>" + escapeHtml(s.summary) + "</p>" +
        colleagueHtml +
        '<button type="button" class="btn btn-sm btn-outline-primary">✏️ Review This One Individually</button>';
      card.querySelector("input[type=checkbox]").addEventListener("change", updateBatchBar);
      card.querySelector("button").addEventListener("click", () => {
        showPage("new-kaizen");
        document.getElementById("nkActionTaken").value = s.suggestedActionTaken || s.title || "";
      });
      host.appendChild(card);
    });

    updateBatchBar();
  }

  function updateBatchBar() {
    const bar = document.getElementById("aiBatchBar");
    const checked = document.querySelectorAll("#aiSuggestionResults .suggestion-check:checked").length;
    if (checked === 0) {
      bar.classList.add("d-none");
      return;
    }
    bar.classList.remove("d-none");
    document.getElementById("aiBatchCount").textContent = checked + " of " + currentSuggestions.length + " selected";
    document.getElementById("btnCreateSelected").textContent = "✅ Create Selected Kaizens (" + checked + ")";
  }

  function createSelectedKaizens() {
    const checkedIndexes = Array.from(document.querySelectorAll("#aiSuggestionResults .suggestion-check:checked"))
      .map((cb) => Number(cb.id.replace("sugCheck", "")));
    if (checkedIndexes.length === 0) return;

    const defaults = Settings.getDefaults();
    const sharedMeta = {
      department: defaults.department || "",
      month: currentMonthLabel(),
      depot: defaults.depot || "",
    };

    const btn = document.getElementById("btnCreateSelected");
    btn.disabled = true;
    let created = 0;
    let failed = 0;

    function next(pos) {
      if (pos >= checkedIndexes.length) {
        btn.disabled = false;
        showToast(
          "Created " + created + " of " + checkedIndexes.length + " Kaizens." + (failed ? " " + failed + " failed — check the Register." : ""),
          failed ? "warning" : "success"
        );
        showPage("register");
        return;
      }

      const originalIndex = checkedIndexes[pos];
      const suggestion = currentSuggestions[originalIndex];
      const checkedColleagues = Array.from(
        document.querySelectorAll('.suggestion-colleague[data-suggestion-index="' + originalIndex + '"]:checked')
      ).map((cb) => cb.value);
      const meta = Object.assign({}, sharedMeta, { name: combineNames(defaults.name || "", checkedColleagues) });

      btn.textContent = "Creating " + (pos + 1) + " of " + checkedIndexes.length + "…";

      AI.generateKaizen(suggestion.suggestedActionTaken || suggestion.title, meta)
        .then((generated) => {
          const kaizen = Object.assign(
            { createdDate: new Date().toISOString() },
            meta,
            generated,
            { actionTaken: generated.improvedActionTaken || suggestion.suggestedActionTaken || suggestion.title || "" }
          );
          return Storage.saveKaizen(kaizen);
        })
        .then(() => { created++; })
        .catch((err) => { failed++; console.error("Batch create failed for suggestion:", suggestion.title, err); })
        .finally(() => next(pos + 1));
    }

    next(0);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function wireAiSuggestionCentre() {
    const fileInput = document.getElementById("aiFileUpload");
    const fileList = document.getElementById("aiFileList");

    fileInput.addEventListener("change", () => {
      fileList.innerHTML = "";
      Array.from(fileInput.files).forEach((file) => {
        const row = document.createElement("div");
        row.className = "small text-muted";
        row.textContent = "📎 " + file.name + " (" + Math.round(file.size / 1024) + " KB) — not analysed yet, paste its text above instead.";
        fileList.appendChild(row);
      });
    });

    const analyzeBtn = document.getElementById("btnAnalyze");
    analyzeBtn.addEventListener("click", () => {
      const text = document.getElementById("aiPasteArea").value.trim();
      if (!text) {
        showToast("Paste some text first — notes, an SOP excerpt, an email thread, anything relevant.", "warning");
        return;
      }
      setButtonBusy(analyzeBtn, true, "Analysing…");
      document.getElementById("aiSuggestionResults").innerHTML = "";
      document.getElementById("aiBatchBar").classList.add("d-none");
      AI.suggestKaizens(text)
        .then((suggestions) => renderSuggestions(suggestions))
        .catch((err) => showToast(err.message, "danger"))
        .finally(() => setButtonBusy(analyzeBtn, false));
    });

    document.getElementById("btnCreateSelected").addEventListener("click", createSelectedKaizens);
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------

  function registerServiceWorker() {
    // Service workers require a secure context (HTTPS or localhost) — browsers
    // refuse registration on file://, so this is a silent no-op there, by design.
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("service-worker.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireNavigation();
    wireNewKaizenForm();
    wireEditKaizenButtons();
    wireEmailModal();
    wireSettingsForm();
    wireAiSuggestionCentre();
    registerServiceWorker();

    document.getElementById("navLogout").addEventListener("click", (e) => {
      e.preventDefault();
      fetch("/api/logout", { method: "POST" }).finally(() => {
        window.location.href = "/login";
      });
    });

    Storage.init()
      .then(() => Settings.load())
      .then(() => showPage("home"))
      .catch((err) => {
        console.error(err);
        showPage("home");
        showToast("Local storage could not be started: " + err.message, "danger");
      });
  });

  // Small surface other modules (register.js) call into.
  window.App = {
    openKaizenForEdit: openKaizenForEdit,
    openEmailModal: openEmailModal,
  };
})();
