import assert from "node:assert/strict";
import test from "node:test";
import {
  CHOICE_NONE, agentTarget, cardNames, hasCard, isSubagent, normalizePath,
  personaTextFor, resolveCard, skipsSubagent, workspaceChoice,
} from "../persona.js";

/** An agent as the host hands it to a section render. */
function agent({ sessionId = "s1", cwd = "D:\\DSH", origin } = {}) {
  return { session: { id: sessionId, header: { cwd, origin } } };
}

const cards = { 大肥鱼: "你是一条大肥鱼。", 严肃: "你很严肃。", 空白: "   " };

test("the default card applies when nothing else chose one", () => {
  const card = resolveCard({ cards, active: "大肥鱼" }, { sessionId: "s1", cwd: "D:\\DSH" });
  assert.deepEqual(card, { name: "大肥鱼", text: "你是一条大肥鱼。", source: "default" });
});

test("a session choice outranks the workspace choice and the default", () => {
  const config = { cards, active: "大肥鱼", sessions: { s1: "严肃" }, workspaces: { "D:\\DSH": "大肥鱼" } };
  assert.equal(resolveCard(config, { sessionId: "s1", cwd: "D:\\DSH" }).name, "严肃");
});

test("a session choice of none disables the persona instead of falling through", () => {
  const config = { cards, active: "大肥鱼", sessions: { s1: CHOICE_NONE }, workspaces: { "D:\\DSH": "严肃" } };
  assert.deepEqual(resolveCard(config, { sessionId: "s1", cwd: "D:\\DSH" }), { name: null, text: null, source: "session" });
});

test("a session choice that names a deleted card falls through, it does not disable", () => {
  const config = { cards, active: "大肥鱼", sessions: { s1: "删掉的卡" } };
  const card = resolveCard(config, { sessionId: "s1", cwd: "D:\\DSH" });
  assert.equal(card.name, "大肥鱼");
  assert.equal(card.source, "default");
});

test("a card whose content is blank cannot be selected", () => {
  const config = { cards, active: "大肥鱼", sessions: { s1: "空白" } };
  assert.equal(resolveCard(config, { sessionId: "s1" }).name, "大肥鱼");
  // …and a blank default is no default at all.
  assert.deepEqual(resolveCard({ cards, active: "空白" }, {}), { name: null, text: null, source: null });
});

test("the workspace mapping applies when the session has no entry of its own", () => {
  const config = { cards, active: "大肥鱼", workspaces: { "D:\\DSH": "严肃" } };
  const card = resolveCard(config, { sessionId: "s9", cwd: "D:\\DSH" });
  assert.deepEqual(card, { name: "严肃", text: "你很严肃。", source: "workspace" });
});

test("a workspace choice of none disables the persona for that workspace", () => {
  const config = { cards, active: "大肥鱼", workspaces: { "D:\\DSH": CHOICE_NONE } };
  assert.deepEqual(resolveCard(config, { cwd: "D:\\DSH" }), { name: null, text: null, source: "workspace" });
});

test("a workspace mapping to a deleted card falls through to the default", () => {
  const config = { cards, active: "大肥鱼", workspaces: { "D:\\DSH": "删掉的卡" } };
  assert.equal(resolveCard(config, { cwd: "D:\\DSH" }).source, "default");
});

test("an empty card map resolves to no persona at all", () => {
  assert.deepEqual(resolveCard({ cards: {}, active: "", sessions: {}, workspaces: {} }, { sessionId: "s1", cwd: "D:\\DSH" }), { name: null, text: null, source: null });
});

test("hand-edited junk in the config is tolerated, not fatal", () => {
  assert.deepEqual(resolveCard({ cards: null, active: 7, sessions: [], workspaces: "D:\\DSH" }, {}), { name: null, text: null, source: null });
  assert.deepEqual(resolveCard(undefined, undefined), { name: null, text: null, source: null });
});

test("only OWN card keys count, so Object.prototype names are not cards", () => {
  assert.equal(hasCard({}, "constructor"), false);
  assert.equal(hasCard({}, "__proto__"), false);
  assert.equal(hasCard({ 大肥鱼: "x" }, "大肥鱼"), true);
  assert.equal(hasCard({ 大肥鱼: "x" }, ""), false);
});

test("cardNames sorts and drops blank cards", () => {
  assert.deepEqual(cardNames({ cards }), ["严肃", "大肥鱼"].sort());
  assert.deepEqual(cardNames({}), []);
});

test("a workspace path is matched exactly first, then across case and separators", () => {
  assert.equal(workspaceChoice({ "D:\\DSH": "严肃" }, "D:\\DSH"), "严肃");
  assert.equal(workspaceChoice({ "D:/DSH/": "严肃" }, "D:\\DSH"), "严肃");
  assert.equal(workspaceChoice({ "d:\\dsh": "严肃" }, "D:\\DSH"), "严肃");
  assert.equal(workspaceChoice({ "D:\\other": "严肃" }, "D:\\DSH"), null);
  assert.equal(workspaceChoice({ "D:\\DSH": "" }, "D:\\DSH"), null);
  assert.equal(workspaceChoice({}, ""), null);
});

test("normalizePath folds separators, trailing slashes and case", () => {
  assert.equal(normalizePath("D:\\DSH\\"), normalizePath("d:/dsh"));
  assert.equal(normalizePath("  "), "");
  assert.equal(normalizePath(undefined), "");
});

test("an agent with throwing getters degrades to an empty target", () => {
  const broken = { get session() { throw new Error("gone"); } };
  assert.deepEqual(agentTarget(broken), { sessionId: "", cwd: "" });
  assert.equal(isSubagent(broken), false);
});

test("agentTarget reads the session id and the workspace cwd", () => {
  assert.deepEqual(agentTarget(agent({ sessionId: "abc", cwd: "D:\\DSH" })), { sessionId: "abc", cwd: "D:\\DSH" });
  assert.deepEqual(agentTarget(null), { sessionId: "", cwd: "" });
});

test("a delegated child gets no injected persona by default", () => {
  const config = { cards, active: "大肥鱼" };
  const child = agent({ origin: "subagent" });
  assert.equal(isSubagent(child), true);
  assert.equal(skipsSubagent(config, child), true);
  assert.equal(personaTextFor(config, child), "");
  // The RESOLUTION is still the parent's card: the tool and the switcher must
  // not disagree with what the session would inject once the gate is off.
  assert.equal(resolveCard(config, agentTarget(child)).name, "大肥鱼");
});

test("skipSubagents: false is the escape hatch", () => {
  const config = { cards, active: "大肥鱼", skipSubagents: false };
  assert.equal(skipsSubagent(config, agent({ origin: "subagent" })), false);
  assert.equal(personaTextFor(config, agent({ origin: "subagent" })), "你是一条大肥鱼。");
});

test("personaTextFor renders the winning card and only a real string", () => {
  assert.equal(personaTextFor({ cards, active: "大肥鱼" }, agent()), "你是一条大肥鱼。");
  assert.equal(personaTextFor({ cards, active: "" }, agent()), "");
  assert.equal(personaTextFor({ cards, active: "大肥鱼" }, null), "你是一条大肥鱼。");
});
