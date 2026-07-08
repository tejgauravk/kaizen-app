/* =========================================================================
   functions/_middleware.js
   Runs before every request to this Pages project (both the static site
   and every /api/ route). Checks for a valid session cookie; if missing,
   redirects page requests to /login.html and returns a 401 for API calls.

   Requires an environment variable named SITE_PASSWORD to be set in
   Cloudflare (Pages project → Settings → Environment variables — add it
   as a secret/encrypted variable, not plain text). Without it configured,
   every request will correctly fail closed (nobody gets in) rather than
   silently failing open.
   ========================================================================= */

const COOKIE_NAME = "kaizen_session";

// Paths that must stay reachable without being logged in yet — the login
// page itself, its two API calls, and the styling it needs to render.
// Cloudflare Pages automatically serves clean URLs (redirects /login.html
// -> /login), so both forms need to be listed here — otherwise that
// automatic redirect fights with this middleware's own redirect and loops
// forever ("too many redirects").
const PUBLIC_PATHS = ["/login", "/login.html", "/api/login", "/api/logout", "/style.css", "/manifest.json"];

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  if (PUBLIC_PATHS.includes(url.pathname) || url.pathname.startsWith("/icons/")) {
    return next();
  }

  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(new RegExp(COOKIE_NAME + "=([^;]+)"));
  const token = match ? decodeURIComponent(match[1]) : null;

  const isAuthenticated = !!env.SITE_PASSWORD && token === env.SITE_PASSWORD;

  if (isAuthenticated) {
    return next();
  }

  if (url.pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Not signed in." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  return Response.redirect(new URL("/login", request.url).toString(), 302);
}
