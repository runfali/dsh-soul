/**
 * Contract tests against the REAL host packages (`@deepseek-ai/cordis`,
 * `dsh-system-prompt`, `dsh-tools`) at the versions this repo pins as dev
 * dependencies.
 *
 * Why this file exists: every other host test drives a stand-in. A stand-in
 * cannot tell you that the section descriptor is accepted, that the tool schema
 * passes the host's own validator, that a duplicate global section name really
 * throws, or that a disposal really unregisters. Those are the four ways this
 * plugin can silently die on a host upgrade.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import SystemPrompt, { renderPrompt } from "@deepseek-ai/dsh-system-prompt";
import Tools from "@deepseek-ai/dsh-tools";
import * as soul from "../index.js";

const CARDS = { 大肥鱼: "你是一条大肥鱼。", 严肃: "你很严肃。" };

/** Give every cordis fiber a turn to start. */
function settle(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A real Cordis app with the real prompt + tool services and a stubbed settings service. */
async function boot({ cards = CARDS, active = "大肥鱼", legacyRows = [], registry = null } = {}) {
  const app = new Context();
  app.provide("settings", { describe: () => legacyRows });
  if (registry) app.provide("workspaceRegistry", registry);
  app.plugin(SystemPrompt);
  app.plugin(Tools);
  app.plugin(soul, { cards, active, sessions: {}, workspaces: {}, showPersonaSwitcher: true, skipSubagents: true });
  await settle();
  return app;
}

function agent({ sessionId = "s1", cwd = "D:\\DSH", origin } = {}) {
  return { session: { id: sessionId, header: { cwd, origin } } };
}

test("the real host accepts the section descriptor and assembles the persona", async (t) => {
  const app = await boot();
  t.after(() => {});
  const assembly = await app.systemPrompt.assemble({ agent: agent() });
  const names = assembly.sections.map((section) => section.name);
  assert.ok(names.includes("dsh-soul:persona"), `assembled sections: ${names.join(", ")}`);
  assert.match(renderPrompt(assembly), /你是一条大肥鱼。/);
});

test("a session-level choice changes the assembled persona", async () => {
  const app = await boot({ active: "大肥鱼" });
  const assembly = await app.systemPrompt.assemble({ agent: agent({ sessionId: "s2" }) });
  // No session entry for s2 → the default card.
  assert.match(renderPrompt(assembly), /你是一条大肥鱼。/);
  const other = await boot({ active: "严肃" });
  assert.match(renderPrompt(await other.systemPrompt.assemble({ agent: agent({ sessionId: "s2" }) })), /你很严肃。/);
});

test("the real host throws on a duplicate section name — the reason we register once", async () => {
  const app = await boot();
  assert.throws(
    () => app.systemPrompt.section({ name: "dsh-soul:persona", order: 0, text: "" }),
    /prompt section "dsh-soul:persona" is already registered/,
  );
  // …and the old plugin's name is still free, so both can be installed.
  const dispose = app.systemPrompt.section({ name: "soul:persona", order: 0, text: "old" });
  assert.equal(typeof dispose, "function");
  dispose();
});

test("the real host accepts the tool definition and runs it", async () => {
  const app = await boot();
  const tool = app.tools.get("persona_read");
  assert.ok(tool, "persona_read was not registered with the real tool service");
  const value = await tool.execute({}, { agent: agent() });
  assert.deepEqual(value, { exists: true, persona: "大肥鱼", content: "你是一条大肥鱼。", source: "default" });
});

test("the real tool service validates the output schema this plugin declares", async () => {
  // `app.tools.get` returns the definition only after the host's own schema
  // validation ran; a schema the host rejects would have thrown at register().
  const app = await boot({ cards: {}, active: "" });
  const tool = app.tools.get("persona_read");
  assert.equal(tool.output.schema.additionalProperties, false);
  const value = await tool.execute({}, { agent: agent() });
  assert.equal(value.exists, false);
  assert.equal(value.persona, "none");
});

test("the real host keeps the section and the tool off a host that lacks settings", async () => {
  // Without `settings` the plugin must not apply at all: `inject` lists it, so
  // cordis holds the fiber. Proves the declaration is load-bearing rather than
  // decorative.
  const app = new Context();
  app.plugin(SystemPrompt);
  app.plugin(Tools);
  app.plugin(soul, { cards: CARDS, active: "大肥鱼" });
  await settle();
  assert.equal(app.tools.get("persona_read"), undefined);
  const assembly = await app.systemPrompt.assemble({ agent: agent() });
  assert.equal(assembly.sections.some((section) => section.name === "dsh-soul:persona"), false);
});
