/* =========================================================================
   functions/api/email-log.js
   GET  /api/email-log  -> most recent 100 email log entries
   POST /api/email-log  { kaizenId, kaizenTitle, recipient } -> records one
   ========================================================================= */

import { json } from "../_shared.js";

export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare("SELECT * FROM email_log ORDER BY id DESC LIMIT 100").all();
  return json(results);
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();
  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    "INSERT INTO email_log (kaizen_id, kaizen_title, recipient, sent_at) VALUES (?,?,?,?)"
  )
    .bind(body.kaizenId || null, body.kaizenTitle || "", body.recipient || "", now)
    .run();

  return json({ id: result.meta.last_row_id });
}
