/* =========================================================================
   dashboard.js
   Renders the Dashboard page: total Kaizens, how many were solo vs done
   with a colleague, how many this month, and a per-colleague breakdown.
   All computed client-side from Storage.getAllKaizens() + the colleague
   roster in Settings — no separate backend endpoint needed.
   ========================================================================= */

const Dashboard = (function () {
  "use strict";

  /** Splits a Kaizen's free-text "Name(s)" field into individual trimmed names. */
  function splitNames(nameField) {
    return (nameField || "").split(",").map((s) => s.trim()).filter(Boolean);
  }

  function isSameMonth(isoDate, refDate) {
    if (!isoDate) return false;
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return false;
    return d.getFullYear() === refDate.getFullYear() && d.getMonth() === refDate.getMonth();
  }

  function render() {
    return Promise.all([Storage.getAllKaizens(), Storage.getEmailLog().catch(() => [])])
      .then(([kaizens, emailLog]) => {
        const colleagues = Settings.getColleagues();
        const now = new Date();

        document.getElementById("dashTotalCount").textContent = kaizens.length;

        let solo = 0;
        let collab = 0;
        let thisMonth = 0;
        const perColleague = {};
        colleagues.forEach((c) => { perColleague[c.toLowerCase()] = { name: c, count: 0 }; });

        kaizens.forEach((k) => {
          const names = splitNames(k.name);
          const hasColleague = colleagues.some((c) =>
            names.some((n) => n.toLowerCase() === c.toLowerCase())
          );
          if (hasColleague) collab++;
          else solo++;

          if (isSameMonth(k.createdDate, now)) thisMonth++;

          names.forEach((n) => {
            const key = n.toLowerCase();
            if (perColleague[key]) perColleague[key].count++;
          });
        });

        document.getElementById("dashSoloCount").textContent = solo;
        document.getElementById("dashCollabCount").textContent = collab;
        document.getElementById("dashMonthCount").textContent = thisMonth;
        document.getElementById("dashMonthLabel").textContent =
          "In " + now.toLocaleDateString("en-US", { month: "long" });

        renderColleagueBreakdown(Object.values(perColleague));
        renderEmailLog(emailLog);
      })
      .catch((err) => {
        window.showToast(err.message, "danger");
      });
  }

  function renderColleagueBreakdown(rows) {
    const host = document.getElementById("dashColleagueBreakdown");
    host.innerHTML = "";

    if (rows.length === 0) {
      host.innerHTML = '<div class="text-muted small">Add colleagues in Settings to see a per-person breakdown here.</div>';
      return;
    }

    rows.sort((a, b) => b.count - a.count);
    const max = Math.max(1, rows[0].count);

    rows.forEach((r) => {
      const row = document.createElement("div");
      row.className = "dash-bar-row";
      const pct = Math.round((r.count / max) * 100);
      row.innerHTML =
        '<div class="dash-bar-name" title="' + escapeHtml(r.name) + '">' + escapeHtml(r.name) + "</div>" +
        '<div class="dash-bar-track"><div class="dash-bar-fill" style="width:' + pct + '%;"></div></div>' +
        '<div class="dash-bar-count">' + r.count + "</div>";
      host.appendChild(row);
    });
  }

  function renderEmailLog(entries) {
    const host = document.getElementById("dashEmailLog");
    host.innerHTML = "";

    if (!entries || entries.length === 0) {
      host.innerHTML = '<div class="text-muted small">No Kaizens have been emailed yet.</div>';
      return;
    }

    entries.slice(0, 10).forEach((e) => {
      const row = document.createElement("div");
      row.className = "small mb-2 pb-2";
      row.style.borderBottom = "1px solid var(--border)";
      row.innerHTML =
        "<strong>" + escapeHtml(e.kaizen_title || "Untitled") + "</strong> → " +
        escapeHtml(e.recipient || "") +
        ' <span class="text-muted">(' + formatDate(e.sent_at) + ")</span>";
      host.appendChild(row);
    });
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  return {
    render: render,
  };
})();
