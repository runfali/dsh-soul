/**
 * The per-session persona switcher, as mounted in the chat header and on the
 * new-session page.
 *
 * The three states are the contract: "" follows the default card, "none" turns
 * the persona off for this session, and a card name pins it. Everything else
 * here guards against writing more than the one key this session owns.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { applyClient, bootClient, findAll, makeScope, one, textOf } from "./helpers/harness.mjs";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const settle = async () => { await tick(); await tick(); };

const CONFIG = {
  cards: { 大肥鱼: "你是一条大肥鱼。", 严肃: "你很严肃。", 空白: "  " },
  active: "大肥鱼",
  sessions: {},
  workspaces: {},
  showPersonaSwitcher: true,
  skipSubagents: true,
};

async function mountSwitcher({ config = CONFIG, sessionId = "s1", hero = false, refuse = false, writable = true, blocks } = {}) {
  const { plugin, mount } = await bootClient({});
  const scope = makeScope(config, { refuse, writable });
  const applied = applyClient(plugin, { scope, localeDict: plugin.__test.dictionaries });
  const name = hero ? "conversation.hero.options" : "conversation.session.header.actions";
  const entry = applied.slots.find((slot) => slot.meta.name === name);
  assert.ok(entry, `${name} was not registered`);
  const element = entry.component({ sessionId, blocks });
  const view = mount(name, element.type, element.props);
  view.runEffects();
  return { plugin, scope, view, applied, entry };
}

function select(view) {
  return one(view.tree, "select", { className: "__sl_switchSelect" });
}

function optionValues(view) {
  return findAll(view.tree, (node) => node.type === "option").map((node) => node.props.value);
}

test("the switcher offers follow-default, off, and every usable card", async () => {
  const { view } = await mountSwitcher();
  assert.deepEqual(optionValues(view), ["", "none", "严肃", "大肥鱼"]);
  assert.equal(select(view).props.value, "", "no session choice follows the default");
});

test("both switcher slots are registered", async () => {
  const { applied } = await mountSwitcher();
  const names = applied.slots.map((slot) => slot.meta.name);
  assert.ok(names.includes("conversation.session.header.actions"));
  assert.ok(names.includes("conversation.hero.options"));
  assert.ok(names.includes("plugins.row.config"));
});

test("a session choice is shown as-is", async () => {
  const { view } = await mountSwitcher({ config: { ...CONFIG, sessions: { s1: "严肃" } } });
  assert.equal(select(view).props.value, "严肃");
});

test("the off state is a choice, not an absence", async () => {
  const { view } = await mountSwitcher({ config: { ...CONFIG, sessions: { s1: "none" } } });
  assert.equal(select(view).props.value, "none");
});

test("a choice naming a card that is gone reads as follow-default", async () => {
  const { view } = await mountSwitcher({ config: { ...CONFIG, sessions: { s1: "已删除的卡" } } });
  assert.equal(select(view).props.value, "");
});

test("a choice naming a blank card also reads as follow-default", async () => {
  const { view } = await mountSwitcher({ config: { ...CONFIG, sessions: { s1: "空白" } } });
  assert.equal(select(view).props.value, "");
});

test("picking a card writes only this session's key", async () => {
  const { scope, view } = await mountSwitcher();
  select(view).props.onChange({ target: { value: "严肃" } });
  await settle();
  assert.deepEqual(scope.writes.at(-1).ops, [{ op: "set", path: ["sessions", "s1"], value: "严肃" }]);
  assert.equal(scope.getSnapshot().value.sessions.s1, "严肃");
});

test("picking follow-default unsets this session's key", async () => {
  const { scope, view } = await mountSwitcher({ config: { ...CONFIG, sessions: { s1: "严肃", s2: "大肥鱼" } } });
  select(view).props.onChange({ target: { value: "" } });
  await settle();
  assert.deepEqual(scope.writes.at(-1).ops, [{ op: "unset", path: ["sessions", "s1"] }]);
  assert.equal(Object.hasOwn(scope.getSnapshot().value.sessions, "s1"), false);
  assert.equal(scope.getSnapshot().value.sessions.s2, "大肥鱼", "another session's choice must survive");
});

test("picking the off state writes the sentinel", async () => {
  const { scope, view } = await mountSwitcher();
  select(view).props.onChange({ target: { value: "none" } });
  await settle();
  assert.deepEqual(scope.writes.at(-1).ops, [{ op: "set", path: ["sessions", "s1"], value: "none" }]);
});

test("a second change while the first is saving is ignored", async () => {
  const { scope, view } = await mountSwitcher();
  const node = select(view);
  node.props.onChange({ target: { value: "严肃" } });
  node.props.onChange({ target: { value: "大肥鱼" } });
  await settle();
  assert.equal(scope.writes.length, 1);
});

test("the switch is hidden when the card says so — and the hero slot is not registered", async () => {
  const { view } = await mountSwitcher({ config: { ...CONFIG, showPersonaSwitcher: false } });
  assert.equal(view.tree, null);
  const { applied } = await mountSwitcher({ config: { ...CONFIG, showPersonaSwitcher: false } });
  assert.equal(applied.slots.some((slot) => slot.meta.name === "conversation.hero.options"), false);
});

test("without a session there is nothing to switch", async () => {
  const { view } = await mountSwitcher({ sessionId: "" });
  assert.equal(view.tree, null);
});

test("a read-only profile shows the choice but cannot change it", async () => {
  const { view } = await mountSwitcher({ writable: false });
  assert.equal(select(view).props.disabled, true);
});

// ── hero slot: holding the composer while the choice saves ────────────────

function fakeBlocks() {
  const state = new Map();
  const sets = [];
  return {
    state,
    sets,
    storeFor(sessionId) {
      return {
        getSnapshot: () => state.get(sessionId),
        subscribe: () => () => {},
      };
    },
    set(sessionId, block) {
      sets.push({ sessionId, block });
      state.set(sessionId, block);
    },
  };
}

test("the hero switcher holds the composer until the choice is stored", async () => {
  const blocks = fakeBlocks();
  const { view } = await mountSwitcher({ hero: true, blocks });
  select(view).props.onChange({ target: { value: "严肃" } });
  assert.deepEqual(blocks.state.get("s1"), { reason: "saving" }, "the composer is held synchronously");
  await settle();
  assert.equal(blocks.state.get("s1"), undefined, "the hold is released once the write settles");
});

test("a refused write still releases the composer and says so", async () => {
  const blocks = fakeBlocks();
  const { view } = await mountSwitcher({ hero: true, blocks, refuse: true });
  select(view).props.onChange({ target: { value: "严肃" } });
  await settle();
  assert.equal(blocks.state.get("s1"), undefined);
  const after = view.rerender();
  assert.match(textOf(after.tree), /宿主没有接受这次修改/);
});

test("the hero switcher renders a hero-marked label", async () => {
  const { view } = await mountSwitcher({ hero: true, blocks: fakeBlocks() });
  assert.ok(textOf(view.tree).includes("人设"), "the label is present");
  assert.match(one(view.tree, "label", { className: "__sl_switch __sl_switchHero" }).props.className, /__sl_switchHero/);
});
