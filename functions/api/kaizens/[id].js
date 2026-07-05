/* =========================================================================
   functions/api/kaizens/[id].js
   GET    /api/kaizens/:id  -> one Kaizen, or 404
   PUT    /api/kaizens/:id  -> update it, returns { id }
   DELETE /api/kaizens/:id  -> delete it
   ========================================================================= */

import { json, rowToKaizen } from "../../_shared.js";

export async function onRequestGet(context) {
  const { env, params } = context;
  const row = await env.DB.prepare("SELECT * FROM kaizens WHERE id = ?").bind(params.id).first();
  if (!row) return json({ error: "Not found" }, 404);
  return json(rowToKaizen(row));
}

export async function onRequestPut(context) {
  const { env, params, request } = context;
  const k = await request.json();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `UPDATE kaizens SET
       title=?, before_text=?, problem=?, actionTaken=?, after_text=?, benefits=?,
       workArea=?, tqmArea=?, name=?, department=?, month=?, depot=?, modifiedDate=?
     WHERE id=?`
  )
    .bind(
      k.title || "",
      k.before || "",
      k.problem || "",
      k.actionTaken || "",
      k.after || "",
      k.benefits || "",
      JSON.stringify(k.workArea || []),
      JSON.stringify(k.tqmArea || []),
      k.name || "",
      k.department || "",
      k.month || "",
      k.depot || "",
      now,
      params.id
    )
    .run();

  return json({ id: Number(params.id) });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  await env.DB.prepare("DELETE FROM kaizens WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
