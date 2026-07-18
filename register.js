/* =========================================================================
   register.js
   Full Kaizen Register: loads from Storage, live search, row selection
   (for exporting a chosen subset), and Edit / Duplicate / Delete actions.

   Sr. No. is the record's permanent database id — assigned once, in
   creation order, and never reused or renumbered even if an earlier
   record is later deleted (so it stays a stable reference number for
   your own records, at the cost of possible gaps after a delete).
   ========================================================================= */

const Register = (function () {
  "use strict";

  /** Last list loaded from Storage, kept so search can filter client-side. */
  let allKaizens = [];

  /** Ids the person has ticked, persisted across re-renders and search. */
  let selectedIds = new Set();

  /**
   * Guards against out-of-order network responses: render() is now a real
   * network round-trip (not instant local IndexedDB), so an older, slower
   * call can resolve after a newer one and silently overwrite it with
   * stale data. Each call gets a token; a response is only applied if it's
   * still the most recent call in flight.
   */
  let renderToken = 0;

  function render() {
    const myToken = ++renderToken;
    return Storage.getAllKaizens()
      .then((list) => {
        if (myToken !== renderToken) return; // a newer render() has since started — ignore this stale result
        allKaizens = list.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
        // Drop selections for anything that no longer exists (e.g. was deleted elsewhere).
        const stillExists = new Set(allKaizens.map((k) => k.id));
        selectedIds.forEach((id) => { if (!stillExists.has(id)) selectedIds.delete(id); });
        applyFilter(currentQuery());
      })
      .catch((err) => {
        if (myToken !== renderToken) return;
        window.showToast(err.message, "danger");
      });
  }

  function currentQuery() {
    const input = document.getElementById("registerSearch");
    return input ? input.value : "";
  }

  function applyFilter(query) {
    query = (query || "").trim().toLowerCase();
    const filtered = !query
      ? allKaizens
      : allKaizens.filter((k) =>
          [k.title, k.department, k.name, k.month].some((v) => (v || "").toLowerCase().includes(query))
        );
    renderRows(filtered, query);
    updateSelectAllState(filtered);
    updateSelectionButtons();
  }

  function renderRows(list, query) {
    const tbody = document.getElementById("registerTableBody");
    const table = document.getElementById("registerTable");
    const emptyState = document.getElementById("registerEmptyState");

    tbody.innerHTML = "";

    if (allKaizens.length === 0) {
      table.classList.add("d-none");
      emptyState.classList.remove("d-none");
      return;
    }

    table.classList.remove("d-none");
    emptyState.classList.add("d-none");

    if (list.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="7" class="text-muted text-center py-4">No Kaizens match "' + escapeHtml(query) + '".</td>';
      tbody.appendChild(tr);
      return;
    }

    list.forEach((k) => tbody.appendChild(buildRow(k)));
  }

  function buildRow(k) {
    const tr = document.createElement("tr");
    const checked = selectedIds.has(k.id) ? "checked" : "";

    tr.innerHTML =
      '<td><input type="checkbox" class="form-check-input row-select" ' + checked + "></td>" +
      "<td>" + k.id + "</td>" +
      "<td>" + escapeHtml(k.title || "(untitled)") + "</td>" +
      "<td>" + escapeHtml(k.department || "—") + "</td>" +
      "<td>" + escapeHtml(k.month || "—") + "</td>" +
      "<td>" + formatDate(k.createdDate) + "</td>" +
      '<td class="text-end">' +
      actionButton("edit", "✏️", "Edit") +
      actionButton("duplicate", "📄", "Duplicate") +
      actionButton("export", "⬇️", "Export") +
      actionButton("email", "✉️", "Email") +
      actionButton("print", "🖨️", "Print") +
      actionButton("delete", "🗑️", "Delete", "text-danger") +
      "</td>";

    tr.dataset.id = k.id;
    return tr;
  }

  function actionButton(action, icon, label, extraClass) {
    return (
      '<button type="button" class="btn btn-sm btn-link text-decoration-none ' + (extraClass || "") + '" ' +
      'data-action="' + action + '" title="' + label + '">' + icon + "</button>"
    );
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------------------------- Selection ----------------------------

  function currentlyFiltered() {
    const query = currentQuery().trim().toLowerCase();
    return !query
      ? allKaizens
      : allKaizens.filter((k) =>
          [k.title, k.department, k.name, k.month].some((v) => (v || "").toLowerCase().includes(query))
        );
  }

  function updateSelectAllState(visibleList) {
    const selectAll = document.getElementById("registerSelectAll");
    if (!visibleList.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }
    const selectedCount = visibleList.filter((k) => selectedIds.has(k.id)).length;
    selectAll.checked = selectedCount === visibleList.length;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < visibleList.length;
  }

  function updateSelectionButtons() {
    const exportBtn = document.getElementById("btnExportSelected");
    const deleteBtn = document.getElementById("btnDeleteSelected");
    const emailBtn = document.getElementById("btnEmailSelected");
    if (selectedIds.size === 0) {
      exportBtn.classList.add("d-none");
      deleteBtn.classList.add("d-none");
      emailBtn.classList.add("d-none");
    } else {
      exportBtn.classList.remove("d-none");
      exportBtn.textContent = "⬇ Export Selected (" + selectedIds.size + ")";
      deleteBtn.classList.remove("d-none");
      deleteBtn.textContent = "🗑️ Delete Selected (" + selectedIds.size + ")";
      emailBtn.classList.remove("d-none");
      emailBtn.textContent = "✉️ Email Selected (" + selectedIds.size + ")";
    }
  }

  function toggleRowSelection(id, checked) {
    if (checked) selectedIds.add(id);
    else selectedIds.delete(id);
    updateSelectAllState(currentlyFiltered());
    updateSelectionButtons();
  }

  function toggleSelectAll(checked) {
    currentlyFiltered().forEach((k) => {
      if (checked) selectedIds.add(k.id);
      else selectedIds.delete(k.id);
    });
    applyFilter(currentQuery());
  }

  // ---------------------------- Row actions ----------------------------

  function editRow(id) {
    Storage.getKaizen(id).then((k) => {
      if (!k) return window.showToast("That Kaizen no longer exists.", "warning");
      window.App.openKaizenForEdit(k);
    });
  }

  function duplicateRow(id) {
    Storage.getKaizen(id).then((k) => {
      if (!k) return window.showToast("That Kaizen no longer exists.", "warning");
      const copy = Object.assign({}, k);
      delete copy.id;
      copy.title = (copy.title || "Kaizen") + " (Copy)";
      copy.createdDate = new Date().toISOString();
      return Storage.saveKaizen(copy);
    }).then(() => {
      render();
      window.showToast("Kaizen duplicated.", "success");
    }).catch((err) => window.showToast(err.message, "danger"));
  }

  function deleteRow(id) {
    if (!window.confirm("Delete this Kaizen? This cannot be undone.")) return;
    Storage.deleteKaizen(id)
      .then(() => {
        selectedIds.delete(id);
        render();
        window.showToast("Kaizen deleted.", "success");
      })
      .catch((err) => window.showToast(err.message, "danger"));
  }

  function exportRow(id) {
    Storage.getKaizen(id).then((k) => {
      if (!k) return;
      Export.exportKaizenToWord(k);
    });
  }

  function emailRow(id) {
    Storage.getKaizen(id).then((k) => {
      if (!k) return window.showToast("That Kaizen no longer exists.", "warning");
      window.App.openEmailModal(k);
    });
  }

  function printRow(id) {
    Storage.getKaizen(id).then((k) => {
      if (!k) return;
      window.App.openKaizenForEdit(k);
      // Give the Edit screen a tick to render before invoking the print dialog.
      setTimeout(() => window.print(), 150);
    });
  }

  function exportSelected() {
    const chosen = allKaizens
      .filter((k) => selectedIds.has(k.id))
      .sort((a, b) => a.id - b.id); // export in Sr. No. order, not table display order
    if (chosen.length === 0) return;
    Export.exportKaizensToWord(chosen, "Kaizen_Selected_" + new Date().toISOString().slice(0, 10) + ".docx");
  }

  function emailSelected() {
    const chosen = allKaizens
      .filter((k) => selectedIds.has(k.id))
      .sort((a, b) => a.id - b.id);
    if (chosen.length === 0) return;
    window.App.openEmailModal(chosen);
  }

  function deleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const label = ids.length === 1 ? "this 1 Kaizen" : "these " + ids.length + " Kaizens";
    if (!window.confirm("Delete " + label + "? This cannot be undone.")) return;

    const btn = document.getElementById("btnDeleteSelected");
    btn.disabled = true;
    let deleted = 0;
    let failed = 0;

    function next(pos) {
      if (pos >= ids.length) {
        btn.disabled = false;
        selectedIds.clear();
        window.showToast(
          "Deleted " + deleted + " of " + ids.length + " Kaizens." + (failed ? " " + failed + " failed." : ""),
          failed ? "warning" : "success"
        );
        render();
        return;
      }
      Storage.deleteKaizen(ids[pos])
        .then(() => { deleted++; })
        .catch((err) => { failed++; console.error("Delete failed for id", ids[pos], err); })
        .finally(() => next(pos + 1));
    }

    next(0);
  }

  // ---------------------------- Wiring ----------------------------

  function handleTableClick(e) {
    const checkbox = e.target.closest(".row-select");
    if (checkbox) {
      const row = e.target.closest("tr[data-id]");
      if (row) toggleRowSelection(Number(row.dataset.id), checkbox.checked);
      return;
    }

    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    const id = Number(row.dataset.id);

    switch (btn.dataset.action) {
      case "edit": return editRow(id);
      case "duplicate": return duplicateRow(id);
      case "delete": return deleteRow(id);
      case "export": return exportRow(id);
      case "email": return emailRow(id);
      case "print": return printRow(id);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("registerTableBody").addEventListener("click", handleTableClick);
    document.getElementById("registerSearch").addEventListener("input", (e) => applyFilter(e.target.value));
    document.getElementById("registerSelectAll").addEventListener("change", (e) => toggleSelectAll(e.target.checked));
    document.getElementById("btnExportAll").addEventListener("click", () => {
      Export.exportKaizensToWord(allKaizens.slice().sort((a, b) => a.id - b.id));
    });
    document.getElementById("btnExportSelected").addEventListener("click", exportSelected);
    document.getElementById("btnEmailSelected").addEventListener("click", emailSelected);
    document.getElementById("btnDeleteSelected").addEventListener("click", deleteSelected);
  });

  return {
    render: render,
  };
})();
