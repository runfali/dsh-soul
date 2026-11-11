import assert from "node:assert/strict";
import test from "node:test";
import { ROUTE_WORKSPACES, SECTION_PERSONA, apply as applyPlugin, name as pluginName, NS } from "../index.js";

/**
 * A host stand-in with exactly the four services this plugin touches.
 *
 * It records WHAT was registered and lets a test call the registrations; it does
 * not re-implement the host. The real host objects are exercised in
 * `host-contract.test.mjs`.
 */
function fakeHost({ config = {}, registry } = {}) {
  const sections = [];
  const tools = [];
  const routes = [];
  const warnings = [];
  const effects = [];
  const state = { config };
  const connection = { fetch: { register: (spec) => { routes.push(spec); return () => {}; } } };
  const ctx = {
    logger: { warn: (message) => warnings.push(message) },
    systemPrompt: {
      section: (section) => {
        // The host throws on a duplicate GLOBAL name; mirroring it here is what
        // makes the "register exactly once" assertion meaningful.
        if (sections.some((existing) => existing.name === section.name)) {
          throw new Error(`prompt section "${section.name}" is already registered`);
        }
        sections.push(section);
        return () => { sections.splice(sections.indexOf(section), 1); };
      },
    },
    tools: {
      register: (tool) => {
        tools.push(tool);
        return () => { tools.splice(tools.indexOf(tool), 1); };
      },
    },
    // Declared by `inject`; the plugin registers no reader of its own any more,
    // but the host needs the service present for the settings document to exist.
    settings: {},
    get: (serviceName) => {
      if (serviceName !== "workspaceRegistry") return undefined;
      if (registry === "throw") throw new Error("service not available");
      return registry;
    },
    inject: (deps, callback) => callback({ connection, effect: (fn) => { effects.push(fn); return fn(); } }),
    effect: (fn) => fn(),
  };
  // The host hands the plugin a REFERENCE whose value is swapped on every write.
  const liveConfig = { get: () => state.config };
  applyPlugin(ctx, liveConfig);
  return { ctx, sections, tools, routes, warnings, effects, state, liveConfig };
}

function agent({ sessionId = "s1", cwd = "D:\\DSH", origin } = {}) {
  return { session: { id: sessionId, header: { cwd, origin } } };
}

const CARDS = { 大肥鱼: "你是一条大肥鱼。", 严肃: "你很严肃。" };

test("the plugin identifies itself as the `soul` entry, not as a package name", () => {
  assert.equal(pluginName, "soul");
  assert.equal(NS, "soul");
});

test("the persona section is registered once, at the front, without interpolation", () => {
  const host = fakeHost({ config: { cards: CARDS, active: "大肥鱼" } });
  assert.equal(host.sections.length, 1);
  const [section] = host.sections;
  assert.equal(section.name, SECTION_PERSONA);
  assert.equal(section.order, 0);
  assert.equal(section.interpolate, false);
  assert.equal(typeof section.text, "function");
});

test("the section name is package-scoped, so no other plugin can collide with it", () => {
  // A duplicate global section name throws, and that throw happens inside
  // apply() — the whole plugin (tools, endpoints, settings) would fail to load.
  assert.notEqual(SECTION_PERSONA, "soul:persona");
  assert.equal(SECTION_PERSONA.startsWith("dsh-soul"), true);
});

test("section text follows the live config without re-registering", () => {
  const host = fakeHost({ config: { cards: CARDS, active: "大肥鱼" } });
  const render = () => host.sections[0].text({ agent: agent() });
  assert.equal(render(), "你是一条大肥鱼。");
  host.state.config = { cards: CARDS, active: "严肃" };
  assert.equal(render(), "你很严肃。");
  host.state.config = { cards: CARDS, active: "严肃", sessions: { s1: "none" } };
  assert.equal(render(), "");
  // Still exactly one registration after three different config documents.
  assert.equal(host.sections.length, 1);
});

test("the section excludes delegated children by default and includes them on request", () => {
  const host = fakeHost({ config: { cards: CARDS, active: "大肥鱼" } });
  assert.equal(host.sections[0].text({ agent: agent({ origin: "subagent" }) }), "");
  host.state.config = { cards: CARDS, active: "大肥鱼", skipSubagents: false };
  assert.equal(host.sections[0].text({ agent: agent({ origin: "subagent" }) }), "你是一条大肥鱼。");
});

test("a resolution failure costs the persona, not the whole prompt", () => {
  const host = fakeHost({ config: { cards: CARDS, active: "大肥鱼" } });
  const brokenAgent = { get session() { throw new Error("host state exploded"); } };
  assert.equal(host.sections[0].text({ agent: brokenAgent }), "你是一条大肥鱼。");
  // And a section render that really throws is caught, reported, and blanked.
  host.liveConfig.get = () => { throw new Error("config gone"); };
  assert.equal(host.sections[0].text({ agent: agent() }), "");
  assert.match(host.warnings.at(-1) ?? "", /config gone/);
});

test("persona_read is registered with a host-valid schema and the expected fields", () => {
  const host = fakeHost({ config: { cards: CARDS, active: "大肥鱼" } });
  assert.equal(host.tools.length, 1);
  const tool = host.tools[0];
  assert.equal(tool.name, "persona_read");
  assert.deepEqual(tool.parameters, {});
  assert.equal(tool.output.schema.type, "object");
  assert.equal(tool.output.schema.additionalProperties, false);
  assert.deepEqual(Object.keys(tool.output.schema.properties).sort(), ["content", "exists", "persona", "source"]);
  assert.equal(tool.isConcurrencySafe(), true);
});

test("persona_read answers with the card this session would get", async () => {
  const host = fakeHost({ config: { cards: CARDS, active: "大肥鱼", sessions: { s2: "严肃" } } });
  const tool = host.tools[0];
  assert.deepEqual(await tool.execute({}, { agent: agent({ sessionId: "s1" }) }), {
    exists: true, persona: "大肥鱼", content: "你是一条大肥鱼。", source: "default",
  });
  assert.deepEqual(await tool.execute({}, { agent: agent({ sessionId: "s2" }) }), {
    exists: true, persona: "严肃", content: "你很严肃。", source: "session",
  });
  host.state.config = { cards: CARDS, active: "" };
  const empty = await tool.execute({}, { agent: agent() });
  assert.equal(empty.exists, false);
  assert.equal(empty.persona, "none");
  assert.equal(empty.content, "");
});

test("persona_read renders a readable block and an explicit empty state", () => {
  const host = fakeHost({ config: { cards: CARDS, active: "大肥鱼" } });
  const render = host.tools[0].output.render;
  assert.deepEqual(render({}, { exists: true, persona: "大肥鱼", content: "你是一条大肥鱼。" }), [
    { type: "text", text: 'Persona card "大肥鱼":\n你是一条大肥鱼。' },
  ]);
  assert.deepEqual(render({}, { exists: false, persona: "none", content: "" }), [
    { type: "text", text: "No persona card is active for this session." },
  ]);
});

test("the read-only endpoint is registered as a POST route", () => {
  const host = fakeHost({ config: {} });
  assert.deepEqual(host.routes.map((route) => route.path), [ROUTE_WORKSPACES]);
  for (const route of host.routes) {
    assert.deepEqual(route.methods, ["POST"]);
    assert.equal(route.requestBody, "buffered");
  }
});

async function call(host, path, request) {
  const route = host.routes.find((candidate) => candidate.path === path);
  assert.ok(route, `route ${path} was not registered`);
  const response = await route.fetch(request ?? new Request(`http://127.0.0.1:8147${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  }));
  return { status: response.status, body: await response.json() };
}

test("the workspace endpoint publishes title + path and drops empty paths", async () => {
  const host = fakeHost({
    config: {},
    registry: { list: () => [{ path: "D:\\DSH", title: "DSH" }, { path: "", title: "ghost" }, { title: "no path" }] },
  });
  const { body } = await call(host, ROUTE_WORKSPACES);
  assert.equal(body.ok, true);
  assert.deepEqual(body.workspaces, [{ path: "D:\\DSH", title: "DSH" }]);
});

test("the workspace endpoint distinguishes absent, not-ready and empty", async () => {
  const absent = await call(fakeHost({ config: {}, registry: undefined }), ROUTE_WORKSPACES);
  assert.equal(absent.body.ok, false);
  assert.equal(absent.body.reason, "absent");

  const notReady = await call(fakeHost({ config: {}, registry: { list: () => { throw new Error("registry warming up"); } } }), ROUTE_WORKSPACES);
  assert.equal(notReady.body.ok, false);
  assert.equal(notReady.body.reason, "not-ready");

  const throwing = await call(fakeHost({ config: {}, registry: "throw" }), ROUTE_WORKSPACES);
  assert.equal(throwing.body.reason, "not-ready");

  const empty = await call(fakeHost({ config: {}, registry: { list: () => [] } }), ROUTE_WORKSPACES);
  assert.equal(empty.body.ok, true);
  assert.deepEqual(empty.body.workspaces, []);
});

test("an optional service is never read as a bare ctx property", () => {
  // `ctx.workspaceRegistry` would throw `cannot get property ... without inject`
  // and take apply() down with it; this host has no such property at all.
  const host = fakeHost({ config: {}, registry: undefined });
  assert.equal("workspaceRegistry" in host.ctx, false);
  assert.equal(host.sections.length, 1);
  assert.equal(host.tools.length, 1);
});
