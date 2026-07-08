/* =========================================================================
   functions/api/logout.js
   POST /api/logout -> clears the session cookie
   ========================================================================= */

export async function onRequestPost() {
  const headers = new Headers({ "content-type": "application/json" });
  headers.append("Set-Cookie", "kaizen_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
