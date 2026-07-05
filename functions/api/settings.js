/* =========================================================================
   functions/api/settings.js
   GET /api/settings  -> the single shared settings object, or null
   PUT /api/settings  -> replace it wholesale (that's how settings.js calls it)
   ========================================================================= */

import { json } from "../_shared.js";

export async function onRequestGet(context) {
  const { env } = context;
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'defaults'").first();
  return json(row ? JSON.parse(row.value) : null);
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const defaults = await request.json();
  await env.DB.prepare(
    `INSERT INTO settings (key, value) VALUES ('defaults', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  )
    .bind(JSON.stringify(defaults))
    .run();
  return json({ ok: true });
}
