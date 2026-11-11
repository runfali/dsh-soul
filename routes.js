/**
 * The read-only HTTP endpoint of dsh-soul, plus the access check it needs.
 *
 * WHY A HAND-WRITTEN CHECK: `/api` exact routes registered through
 * `connection.fetch` do NOT pass the host's own fence or browser-auth gate, so
 * an endpoint that only parses its body is reachable by any page in the user's
 * browser (CSRF) and by anything that can POST. The check below is the minimum
 * that makes a same-origin, JSON-only read endpoint safe:
 *
 *   - a non-JSON content type is refused with 415. A cross-site <form> can only
 *     send urlencoded/multipart/plain, so this alone blocks the classic CSRF
 *     POST — and it is why the client always sends application/json.
 *   - a cross-site `Origin` is refused with 403, and `Origin: null` too (a
 *     sandboxed iframe or a file:// page). Same-origin fetches send an Origin
 *     header in Chromium, so an attacker's page cannot omit it. Same-origin is
 *     judged against the request's `Host` header, NOT against `request.url`: the
 *     host bridges every HTTP request through a synthetic base URL (see
 *     `bridge()` in @deepseek-ai/dsh-client-connection, which does
 *     `new Request(new URL(req.url, "http://dsh.internal"), …)`), so a route
 *     handler always sees `http://dsh.internal/...` no matter which origin the
 *     browser used. Comparing those two origins refuses every legitimate call.
 *   - `Sec-Fetch-Site` is refused when it says cross-site / same-site. It is
 *     browser-supplied and cannot be forged by page script.
 *
 * A client with NO Origin header (curl, the tests, a future CLI) is allowed:
 * refusing it would buy no protection (the check exists for browsers, and a
 * local process can pass any header it likes) while breaking local scripted
 * reads.
 *
 * Both endpoints are POST because they answer with live host state: a GET would
 * also be cached and prefetched by proxies and browsers.
 */

/** The wire version of every payload this module returns. Bump only with a shape change. */
export const ROUTE_VERSION = 1;

const JSON_TYPE = "application/json";
const REFUSED = "cross-site request refused";

/** One JSON response, never cached. */
export function jsonBody(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function headerOf(request, name) {
  const headers = request?.headers;
  if (!headers || typeof headers.get !== "function") return null;
  return headers.get(name);
}

/** Absolute URL or null; a relative/garbage value must not throw past the check. */
function parseUrl(value) {
  try {
    return new URL(String(value));
  } catch {
    return null;
  }
}

/**
 * A reason to refuse this request, or null to serve it.
 *
 * Pure and exported so the test suite can assert every branch without a socket.
 */
export function requestRefusal(request) {
  // Split off the parameters and compare the WHOLE type: `startsWith` accepts
  // `application/jsonscript`, which is not a JSON body at all.
  const type = String(headerOf(request, "content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (type !== JSON_TYPE) return { status: 415, error: "expected a JSON request body" };

  const site = String(headerOf(request, "sec-fetch-site") ?? "").toLowerCase();
  if (site !== "" && site !== "same-origin" && site !== "none") return { status: 403, error: REFUSED };

  const origin = headerOf(request, "origin");
  // `headers.get` returns null for an absent header; an empty value is not absent.
  if (origin !== null) {
    const claimed = String(origin).trim();
    if (claimed === "" || claimed === "null") return { status: 403, error: REFUSED };
    // Same-origin means "the Origin names the very host the browser addressed",
    // which only the Host header can answer — `request.url` is the bridge's
    // synthetic base (http://dsh.internal), never the browser's origin.
    const host = String(headerOf(request, "host") ?? "").trim().toLowerCase();
    if (host === "") return { status: 403, error: REFUSED };
    const claimedUrl = parseUrl(claimed);
    if (claimedUrl === null || claimedUrl.host.toLowerCase() !== host) return { status: 403, error: REFUSED };
  }
  return null;
}

/** One line of host error text for a log line and the response body. */
export function oneLine(error) {
  const text = String(error?.message ?? error ?? "").replace(/\s+/g, " ").trim();
  return text.length > 300 ? `${text.slice(0, 297)}...` : text;
}

function warn(ctx, message) {
  try {
    const logger = ctx?.logger;
    if (logger && typeof logger.warn === "function") logger.warn(message);
  } catch {
    /* a broken logger must never take a request down */
  }
}

/**
 * Register one POST route whose body is built by `build()`.
 *
 * `connection` is an OPTIONAL service: the read of it must not be a plain
 * property access (that throws and the whole plugin fails to load on a host
 * without it), and a host that has no connection service simply gets no
 * endpoint — the settings card then shows "unavailable" instead of a crash.
 *
 * Returns whether the injection was wired, for the tests.
 */
export function registerJsonRoute(ctx, { path, build, label }) {
  if (!ctx || typeof ctx.inject !== "function") {
    warn(ctx, `dsh-soul: ${path} not registered (host has no ctx.inject)`);
    return false;
  }
  const handler = async (request) => {
    const refusal = requestRefusal(request);
    if (refusal) return jsonBody({ version: ROUTE_VERSION, error: refusal.error }, refusal.status);
    try {
      return jsonBody(await build());
    } catch (error) {
      warn(ctx, `dsh-soul: ${path} failed: ${oneLine(error)}`);
      return jsonBody({ version: ROUTE_VERSION, error: oneLine(error) }, 500);
    }
  };
  // Registering must never be able to fail `apply`: a host that refuses the
  // route (older instance, duplicate path, a settled scope) should cost the
  // settings card one "unavailable" line, not the persona section and the tool.
  try {
    ctx.inject(["connection"], (scoped) => {
      try {
        const register = scoped?.connection?.fetch?.register;
        if (typeof register !== "function") {
          warn(ctx, `dsh-soul: ${path} not registered (connection.fetch.register is missing)`);
          return;
        }
        scoped.effect(
          () => scoped.connection.fetch.register({ path, methods: ["POST"], requestBody: "buffered", fetch: handler }),
          label ?? `dsh-soul: ${path}`,
        );
      } catch (error) {
        warn(ctx, `dsh-soul: ${path} not registered: ${oneLine(error)}`);
      }
    });
  } catch (error) {
    warn(ctx, `dsh-soul: ${path} not registered: ${oneLine(error)}`);
    return false;
  }
  return true;
}
