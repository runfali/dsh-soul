import assert from "node:assert/strict";
import test from "node:test";
import { ROUTE_VERSION, jsonBody, oneLine, registerJsonRoute, requestRefusal } from "../routes.js";

const URL_UNDER_TEST = "http://127.0.0.1:8147/api/soul/import";

function request({ method = "POST", headers = {}, url = URL_UNDER_TEST } = {}) {
  return new Request(url, { method, headers });
}

const JSON_HEADERS = { "content-type": "application/json" };

test("a non-JSON body is refused with 415 — the check that blocks a cross-site form post", async () => {
  for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", ""]) {
    const refusal = requestRefusal(request({ headers: { "content-type": type } }));
    assert.equal(refusal?.status, 415, `content-type ${JSON.stringify(type)}`);
  }
  const response = await jsonBody({ error: "x" }, 415);
  assert.equal(response.status, 415);
});

test("a missing content type is refused too", () => {
  assert.equal(requestRefusal(request()).status, 415);
});

test("a same-origin Origin is allowed", () => {
  const headers = { ...JSON_HEADERS, origin: "http://127.0.0.1:8147" };
  assert.equal(requestRefusal(request({ headers })), null);
});

test("a cross-site Origin is refused with 403", () => {
  const headers = { ...JSON_HEADERS, origin: "https://evil.example" };
  assert.equal(requestRefusal(request({ headers })).status, 403);
});

test("Origin: null (sandboxed iframe / file://) is refused", () => {
  for (const origin of ["null", ""]) {
    const headers = { ...JSON_HEADERS, origin };
    assert.equal(requestRefusal(request({ headers })).status, 403, `origin ${JSON.stringify(origin)}`);
  }
});

test("a request with no Origin is allowed — that is curl, not a browser", () => {
  assert.equal(requestRefusal(request({ headers: JSON_HEADERS })), null);
});

test("Sec-Fetch-Site is honoured when the browser sends it", () => {
  for (const site of ["cross-site", "same-site", "CROSS-SITE"]) {
    const headers = { ...JSON_HEADERS, "sec-fetch-site": site };
    assert.equal(requestRefusal(request({ headers })).status, 403, site);
  }
  for (const site of ["same-origin", "none"]) {
    const headers = { ...JSON_HEADERS, "sec-fetch-site": site };
    assert.equal(requestRefusal(request({ headers })), null, site);
  }
});

test("an Origin that cannot be compared to a relative request URL is refused", () => {
  // `new Request` rejects a relative URL, so this is the one shape that has to be
  // hand-built — a host that ever hands over a path-only request gets the same
  // refusal instead of a silent pass.
  const headers = { ...JSON_HEADERS, origin: "http://127.0.0.1:8147" };
  const relative = { url: "/api/soul/import", headers: new Headers(headers) };
  assert.equal(requestRefusal(relative).status, 403);
});

test("a matching origin on a different port is still cross-site", () => {
  const headers = { ...JSON_HEADERS, origin: "http://127.0.0.1:9999" };
  assert.equal(requestRefusal(request({ headers })).status, 403);
});

test("oneLine collapses whitespace and caps the text", () => {
  assert.equal(oneLine(new Error("a\n b\tc")), "a b c");
  assert.equal(oneLine("x".repeat(400)).length, 300);
  assert.equal(oneLine(undefined), "");
});

/** A ctx whose connection service captures the route the plugin registers. */
function fakeCtx({ withInject = true, withConnection = true } = {}) {
  const routes = [];
  const effects = [];
  const warnings = [];
  const connection = withConnection
    ? { fetch: { register: (spec) => { routes.push(spec); return () => {}; } } }
    : {};
  const ctx = {
    logger: { warn: (message) => warnings.push(message) },
    inject: withInject ? (deps, callback) => callback({ connection, effect: (fn) => { effects.push(fn); return fn(); } }) : undefined,
  };
  return { ctx, routes, effects, warnings };
}

test("the route is registered as a buffered POST with a handler", () => {
  const { ctx, routes } = fakeCtx();
  const wired = registerJsonRoute(ctx, { path: "/api/soul/x", build: () => ({ version: 1, ok: true }) });
  assert.equal(wired, true);
  assert.equal(routes.length, 1);
  assert.deepEqual(routes[0].methods, ["POST"]);
  assert.equal(routes[0].requestBody, "buffered");
  assert.equal(typeof routes[0].fetch, "function");
});

test("the handler serves the built payload, never cached", async () => {
  const { ctx, routes } = fakeCtx();
  registerJsonRoute(ctx, { path: "/api/soul/x", build: () => ({ version: ROUTE_VERSION, ok: true }) });
  const response = await routes[0].fetch(request({ headers: JSON_HEADERS }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { version: ROUTE_VERSION, ok: true });
});

test("the handler applies the access check before building anything", async () => {
  let built = 0;
  const { ctx, routes } = fakeCtx();
  registerJsonRoute(ctx, { path: "/api/soul/x", build: () => { built += 1; return {}; } });
  const refused = await routes[0].fetch(request({ headers: { "content-type": "text/plain" } }));
  assert.equal(refused.status, 415);
  assert.equal(built, 0);
  assert.equal((await refused.json()).version, ROUTE_VERSION);
  const crossSite = await routes[0].fetch(request({ headers: { ...JSON_HEADERS, origin: "https://evil.example" } }));
  assert.equal(crossSite.status, 403);
  assert.equal(built, 0);
});

test("a throwing build answers 500 with a one-line reason and warns", async () => {
  const { ctx, routes, warnings } = fakeCtx();
  registerJsonRoute(ctx, { path: "/api/soul/x", build: () => { throw new Error("boom\nhere"); } });
  const response = await routes[0].fetch(request({ headers: JSON_HEADERS }));
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error, "boom here");
  assert.match(warnings[0] ?? "", /boom here/);
});

test("a host without ctx.inject gets no route and no crash", () => {
  const { ctx, routes, warnings } = fakeCtx({ withInject: false });
  assert.equal(registerJsonRoute(ctx, { path: "/api/soul/x", build: () => ({}) }), false);
  assert.equal(routes.length, 0);
  assert.match(warnings[0] ?? "", /no ctx\.inject/);
});

test("a connection service without fetch.register degrades instead of throwing", () => {
  const { ctx, routes, warnings } = fakeCtx({ withConnection: false });
  assert.equal(registerJsonRoute(ctx, { path: "/api/soul/x", build: () => ({}) }), true);
  assert.equal(routes.length, 0);
  assert.match(warnings[0] ?? "", /connection\.fetch\.register is missing/);
});

test("jsonBody always carries the JSON content type", async () => {
  const response = jsonBody({ a: 1 });
  assert.match(response.headers.get("content-type"), /^application\/json/);
  assert.deepEqual(await response.json(), { a: 1 });
});
