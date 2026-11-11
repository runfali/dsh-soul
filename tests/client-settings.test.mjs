/**
 * Behaviour of the settings card, driven through the real components.
 *
 * These are the flows where a bug corrupts the user's own cards: create, rename
 * (one batch or the card is lost), delete (two clicks, and the default card goes
 * with it), single-key writes for maps, and the refusal path where the host
 * says no but the write still resolves.
 *
 * Typing goes through `typeInto`, which re-renders afterwards: a real user types
 * and THEN clicks, so the handler that runs must come from the newer tree. A
 * test that clicks the pre-typing tree asserts against a stale draft and would
 * fail on correct code.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { applyClient, bootClient, buttonByText, find, findAll, makeScope, one, textOf } from "./helpers/harness.mjs";
import { ROUTE_WORKSPACES } from "../index.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const settle = async () => { await tick(); await tick(); };

const BASE_CONFIG = {
  cards: { 大肥鱼: "你是一条大肥鱼。", 严肃: "你很严肃。" },
  active: "大肥鱼",
  sessions: {},
  workspaces: {},
  showPersonaSwitcher: true,
  skipSubagents: true,
};

/** Boot, apply, mount the settings component, and run its mount effects. */
async function mountSettings({ config = BASE_CONFIG, refuse = false, writable = true, base, fetch } = {}) {
  const { plugin, mount } = await bootClient({ fetch });
  const scope = makeScope(config, { refuse, writable, base });
  const applied = applyClient(plugin, { scope, localeDict: plugin.__test.dictionaries });
  const entry = applied.slots.find((slot) => slot.meta.name === "plugins.bundle.config");
  const element = entry.component({});
  let view = mount("settings", element.type, element.props);
  view.runEffects();
  await settle();
  view = view.rerender();
  view.runEffects();
  await settle();
  return { plugin, scope, view, applied };
}

/** Re-render so the tree reflects whatever the last handler wrote. */
function refresh(view) {
  return view.rerender();
}

/** Type into the card form and re-render, as a user's next click would. */
function typeInto(view, which, value) {
  const node = which === "textarea" ? one(view.tree, "textarea") : one(view.tree, "input", { type: "text" });
  node.props.onChange({ target: { value } });
  return view.rerender();
}

function cardRows(view) {
  return findAll(view.tree, (node) => node.props.className === "__sl_cardRow");
}

function cardRow(view, name) {
  const row = cardRows(view).find((node) => textOf(node).includes(name));
  assert.ok(row, `no card row for ${name}`);
  return row;
}

test("the card list renders every usable card and marks the default", async () => {
  const { view } = await mountSettings();
  assert.equal(cardRows(view).length, 2);
  assert.match(textOf(cardRow(view, "大肥鱼")), /你是一条大肥鱼/);
  // Exactly one row carries the badge — the row text alone cannot prove it,
  // because the other row's button says 设为默认.
  const badges = findAll(view.tree, (node) => node.props.className === "__sl_badge");
  assert.equal(badges.length, 1);
  assert.equal(textOf(badges[0]), "默认");
  assert.equal(findAll(cardRow(view, "严肃"), (node) => node.props.className === "__sl_badge").length, 0);
});

test("a blank-content card is not offered as a card", async () => {
  const { view } = await mountSettings({ config: { ...BASE_CONFIG, cards: { 大肥鱼: "你是一条大肥鱼。", 空白: "   " } } });
  assert.equal(/空白/.test(textOf(view.tree)), false);
});

test("saving a new card writes exactly one nested key", async () => {
  const { scope, view } = await mountSettings();
  let state = typeInto(view, "input", "新卡");
  state = typeInto(state, "textarea", "新内容");
  buttonByText(state.tree, "新建卡片").props.onClick();
  await settle();
  assert.deepEqual(scope.writes.at(-1).ops, [{ op: "set", path: ["cards", "新卡"], value: "新内容" }]);
  assert.equal(scope.getSnapshot().value.cards["新卡"], "新内容");
  assert.match(textOf(refresh(view).tree), /已保存/);
});

test("an empty name, an empty body and a prototype name are refused before any write", async () => {
  const { scope, view } = await mountSettings();
  let state = view;
  for (const [name, content] of [["", "内容"], ["卡", "   "], ["__proto__", "内容"], ["prototype", "内容"]]) {
    state = typeInto(state, "input", name);
    state = typeInto(state, "textarea", content);
    buttonByText(state.tree, "新建卡片").props.onClick();
    await settle();
    assert.equal(scope.writes.length, 0, `a write slipped through for ${JSON.stringify(name)}`);
    state = refresh(state);
    assert.ok(find(state.tree, (node) => node.props.role === "alert"), "no error was shown");
  }
});

test("renaming a card sends set-new and unset-old in ONE batch", async () => {
  const { scope, view } = await mountSettings();
  buttonByText(cardRow(view, "严肃"), "编辑").props.onClick();
  let state = refresh(view);
  assert.equal(one(state.tree, "input", { type: "text" }).props.value, "严肃");
  state = typeInto(state, "input", "很严肃");
  buttonByText(state.tree, "保存卡片").props.onClick();
  await settle();
  assert.equal(scope.writes.length, 1, "a rename must not be two writes");
  assert.deepEqual(scope.writes[0].ops, [
    { op: "set", path: ["cards", "很严肃"], value: "你很严肃。" },
    { op: "unset", path: ["cards", "严肃"] },
  ]);
  const cards = scope.getSnapshot().value.cards;
  assert.deepEqual(Object.keys(cards).sort(), ["大肥鱼", "很严肃"].sort());
});

test("renaming onto an existing card is refused instead of overwriting it", async () => {
  const { scope, view } = await mountSettings();
  buttonByText(cardRow(view, "严肃"), "编辑").props.onClick();
  let state = typeInto(refresh(view), "input", "大肥鱼");
  buttonByText(state.tree, "保存卡片").props.onClick();
  await settle();
  assert.equal(scope.writes.length, 0);
  assert.match(textOf(refresh(state).tree), /已存在同名人设卡/);
});

test("editing a card's body keeps its name", async () => {
  const { scope, view } = await mountSettings();
  buttonByText(cardRow(view, "严肃"), "编辑").props.onClick();
  let state = typeInto(refresh(view), "textarea", "改过的内容");
  buttonByText(state.tree, "保存卡片").props.onClick();
  await settle();
  assert.deepEqual(scope.writes.at(-1).ops, [{ op: "set", path: ["cards", "严肃"], value: "改过的内容" }]);
});

test("delete needs two clicks, and removing the default clears it in the same batch", async () => {
  const { scope, view } = await mountSettings();
  buttonByText(cardRow(view, "大肥鱼"), "删除").props.onClick();
  await settle();
  assert.equal(scope.writes.length, 0, "one click must not delete");
  const confirming = refresh(view);
  buttonByText(cardRow(confirming, "大肥鱼"), "再点一次删除").props.onClick();
  await settle();
  assert.deepEqual(scope.writes[0].ops, [
    { op: "unset", path: ["cards", "大肥鱼"] },
    { op: "unset", path: ["active"] },
  ]);
  assert.equal(scope.getSnapshot().value.active, undefined);
});

test("deleting a non-default card leaves the default alone", async () => {
  const { scope, view } = await mountSettings();
  buttonByText(cardRow(view, "严肃"), "删除").props.onClick();
  await settle();
  const armed = refresh(view);
  buttonByText(cardRow(armed, "严肃"), "再点一次删除").props.onClick();
  await settle();
  assert.deepEqual(scope.writes[0].ops, [{ op: "unset", path: ["cards", "严肃"] }]);
  assert.equal(scope.getSnapshot().value.active, "大肥鱼");
});

test("making a card the default writes only `active`", async () => {
  const { scope, view } = await mountSettings();
  buttonByText(cardRow(view, "严肃"), "设为默认").props.onClick();
  await settle();
  assert.deepEqual(scope.writes.at(-1).ops, [{ op: "set", path: ["active"], value: "严肃" }]);
});

test("a workspace choice writes one key, and clearing it unsets that key", async () => {
  const fetch = async (url) => {
    assert.equal(url, ROUTE_WORKSPACES);
    return new Response(JSON.stringify({ version: 1, ok: true, workspaces: [{ path: "D:\\DSH", title: "DSH" }, { path: "D:\\Other", title: "Other" }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const { scope, view } = await mountSettings({ fetch });
  const wsSelects = (tree) => findAll(tree, (node) => node.type === "select" && node.props.className === "__sl_input");
  assert.equal(wsSelects(view.tree).length, 2);
  wsSelects(view.tree)[0].props.onChange({ target: { value: "严肃" } });
  await settle();
  assert.deepEqual(scope.writes.at(-1).ops, [{ op: "set", path: ["workspaces", "D:\\DSH"], value: "严肃" }]);
  wsSelects(refresh(view).tree)[0].props.onChange({ target: { value: "" } });
  await settle();
  assert.deepEqual(scope.writes.at(-1).ops, [{ op: "unset", path: ["workspaces", "D:\\DSH"] }]);
});

test("a saved mapping whose workspace is gone is still listed and can be cleared", async () => {
  const fetch = async () => new Response(JSON.stringify({ version: 1, ok: true, workspaces: [] }), { status: 200, headers: { "content-type": "application/json" } });
  const { scope, view } = await mountSettings({ config: { ...BASE_CONFIG, workspaces: { "D:\\Gone": "严肃" } }, fetch });
  assert.match(textOf(view.tree), /这个工作区已不在列表里/);
  const selects = findAll(view.tree, (node) => node.type === "select" && node.props.className === "__sl_input");
  assert.equal(selects.length, 1);
  selects[0].props.onChange({ target: { value: "" } });
  await settle();
  assert.deepEqual(scope.writes.at(-1).ops, [{ op: "unset", path: ["workspaces", "D:\\Gone"] }]);
});

test("an unreachable workspace endpoint says so instead of claiming there are none", async () => {
  const fetch = async () => new Response(JSON.stringify({ version: 1, error: "nope" }), { status: 500, headers: { "content-type": "application/json" } });
  const { view } = await mountSettings({ fetch });
  assert.match(textOf(view.tree), /读不到宿主的工作区列表/);
});

test("both toggles write a single boolean key", async () => {
  const { scope, view } = await mountSettings();
  const switches = () => findAll(view.tree, (node) => node.type === "button" && node.props.role === "switch");
  assert.equal(switches().length, 2, "one switch per flag");
  assert.equal(switches()[0].props["aria-checked"], true);
  switches()[0].props.onClick();
  await settle();
  assert.deepEqual(scope.writes.at(-1).ops, [{ op: "set", path: ["showPersonaSwitcher"], value: false }]);
  switches()[1].props.onClick();
  await settle();
  assert.deepEqual(scope.writes.at(-1).ops, [{ op: "set", path: ["skipSubagents"], value: false }]);
});

test("a refused write reports notApplied and keeps the user's draft", async () => {
  const { scope, view } = await mountSettings({ refuse: true });
  let state = typeInto(view, "input", "新卡");
  state = typeInto(state, "textarea", "新内容");
  buttonByText(state.tree, "新建卡片").props.onClick();
  await settle();
  assert.equal(scope.writes.length, 1, "the write was attempted");
  const after = refresh(state);
  assert.match(textOf(after.tree), /宿主没有接受这次修改/);
  assert.equal(one(after.tree, "input", { type: "text" }).props.value, "新卡");
  assert.equal(one(after.tree, "textarea").props.value, "新内容");
});

test("a read-only profile disables every control", async () => {
  const { view } = await mountSettings({ writable: false });
  assert.equal(one(view.tree, "fieldset", { className: "__sl_root dsh-flat" }).props.disabled, true);
  // The fieldset cascades in a browser; the rows that carry their own disabled
  // binding must agree, or a control stays live behind a greyed card.
  const switches = findAll(view.tree, (node) => node.type === "button" && node.props.role === "switch");
  assert.equal(switches.length, 2);
  for (const node of switches) assert.equal(node.props.disabled, true);
  for (const node of findAll(view.tree, (node) => node.type === "select")) assert.equal(node.props.disabled, true);
  for (const node of findAll(view.tree, (node) => node.type === "button" && node.props.role === undefined)) {
    assert.equal(node.props.disabled, true, "row actions are disabled too");
  }
});


test("creating a card under an existing name is refused instead of overwriting it", async () => {
  const { scope, view } = await mountSettings();
  let state = typeInto(view, "input", "严肃");
  state = typeInto(state, "textarea", "完全不同的内容");
  buttonByText(state.tree, "新建卡片").props.onClick();
  await settle();
  assert.equal(scope.writes.length, 0, "nothing may be written");
  assert.match(textOf(refresh(state).tree), /新建会覆盖它/);
  assert.equal(scope.getSnapshot().value.cards["严肃"], "你很严肃。");
});

test("a blank card can be filled in, because it has no row to click", async () => {
  // A hand-written `cards: {X: ""}` renders no row at all, so a create that
  // refused to touch it would be a name the user can never repair.
  const { scope, view } = await mountSettings({ config: { ...BASE_CONFIG, cards: { 大肥鱼: "你是一条大肥鱼。", 旧卡: "" } } });
  let state = typeInto(view, "input", "旧卡");
  state = typeInto(state, "textarea", "补上的内容");
  buttonByText(state.tree, "新建卡片").props.onClick();
  await settle();
  assert.deepEqual(scope.writes.at(-1).ops, [{ op: "set", path: ["cards", "旧卡"], value: "补上的内容" }]);
});

test("an endpoint that answers ok:false is a failure, not an empty list", async () => {
  const fetch = async () => new Response(JSON.stringify({ version: 1, ok: false, reason: "absent" }), { status: 200, headers: { "content-type": "application/json" } });
  const { view } = await mountSettings({ fetch });
  assert.match(textOf(view.tree), /读不到宿主的工作区列表/);
  assert.doesNotMatch(textOf(view.tree), /宿主还没有登记工作区/);
});

test("a failed workspace read does not mark saved mappings stale", async () => {
  const fetch = async () => new Response(JSON.stringify({ version: 1, error: "nope" }), { status: 500, headers: { "content-type": "application/json" } });
  const { view } = await mountSettings({ config: { ...BASE_CONFIG, workspaces: { "D:\\Gone": "严肃" } }, fetch });
  // The read never produced a list, so "not in the list" is a claim about data
  // this page does not have; the row renders plain and stays editable.
  assert.doesNotMatch(textOf(view.tree), /这个工作区已不在列表里/);
  assert.equal(findAll(view.tree, (node) => node.type === "select").length, 1);
});

test("a card declared by the host configuration layer says why it cannot be deleted", async () => {
  const { scope, view } = await mountSettings({ base: { cards: { 大肥鱼: "你是一条大肥鱼。", 严肃: "你很严肃。" } } });
  buttonByText(cardRow(view, "严肃"), "删除").props.onClick();
  await settle();
  let state = refresh(view);
  buttonByText(cardRow(state, "严肃"), "再点一次删除").props.onClick();
  await settle();
  assert.deepEqual(scope.writes.at(-1).ops, [{ op: "unset", path: ["cards", "严肃"] }]);
  state = refresh(state);
  assert.match(textOf(state.tree), /宿主配置层/);
  // The card is still resolved by the host, so the row must still be there.
  assert.ok(cardRows(state).some((row) => textOf(row).includes("严肃")));
});

test("the preview truncates by code point, never mid-character", async () => {
  const { plugin } = await mountSettings();
  const preview = plugin.__test.cardPreview("🐟".repeat(70));
  assert.equal(preview, "🐟".repeat(64) + "…");
  assert.equal(Array.from(preview).length, 65);
  assert.equal(plugin.__test.cardPreview("短\n第二行"), "短");
});
