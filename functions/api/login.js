/* =========================================================================
   functions/api/login.js
   POST /api/login  { password } -> sets the session cookie if correct
   ========================================================================= */

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SITE_PASSWORD) {
    return new Response(
      JSON.stringify({ error: "The site password hasn't been configured yet (missing SITE_PASSWORD)." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Bad request." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const submitted = (body && body.password) || "";
  if (submitted !== env.SITE_PASSWORD) {
    return new Response(JSON.stringify({ error: "Incorrect password." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const headers = new Headers({ "content-type": "application/json" });
  // 30-day session so people aren't asked to sign in every single visit.
  headers.append(
    "Set-Cookie",
    "kaizen_session=" + encodeURIComponent(submitted) + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000"
  );
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
