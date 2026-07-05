/* =========================================================================
   functions/_shared.js
   Small helpers shared by the Pages Functions API endpoints. Not itself a
   route (no onRequest export), just imported by the actual endpoint files.
   ========================================================================= */

export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json" },
  });
}

/** Converts a D1 row (snake_ish column names, JSON-string areas) into the shape the frontend expects. */
export function rowToKaizen(row) {
  return {
    id: row.id,
    title: row.title || "",
    before: row.before_text || "",
    problem: row.problem || "",
    actionTaken: row.actionTaken || "",
    after: row.after_text || "",
    benefits: row.benefits || "",
    workArea: safeParseArray(row.workArea),
    tqmArea: safeParseArray(row.tqmArea),
    name: row.name || "",
    department: row.department || "",
    month: row.month || "",
    depot: row.depot || "",
    createdDate: row.createdDate,
    modifiedDate: row.modifiedDate,
  };
}

function safeParseArray(text) {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}
