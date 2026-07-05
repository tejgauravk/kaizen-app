/* =========================================================================
   functions/api/kaizens.js
   GET  /api/kaizens  -> list every saved Kaizen
   POST /api/kaizens  -> create a new one, returns { id }
   ========================================================================= */

import { json, rowToKaizen } from "../_shared.js";

export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare("SELECT * FROM kaizens ORDER BY id DESC").all();
  return json(results.map(rowToKaizen));
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const k = await request.json();
  const now = new Date().toISOString();
  const createdDate = k.createdDate || now;

  const result = await env.DB.prepare(
    `INSERT INTO kaizens
       (title, before_text, problem, actionTaken, after_text, benefits, workArea, tqmArea,
        name, department, month, depot, createdDate, modifiedDate)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
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
      createdDate,
      now
    )
    .run();

  return json({ id: result.meta.last_row_id });
}
