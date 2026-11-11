/**
 * The client bundle's own shape: what the host loader reads, and the invariants
 * that fail silently when broken (a missing translation renders the key's name,
 * a wrong bundle id leaves the card unmounted, a duplicated style tag restyles
 * the whole settings page twice).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyClient, bootClient } from "./helpers/harness.mjs";

const SOURCE_URL = new URL("../client.js", import.meta.url);
const source = await readFile(SOURCE_URL, "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

function fakeDocument() {
  const styles = [];
  return {
    styles,
    querySelector: (selector) => styles.find((tag) => selector.includes(JSON.stringify(tag.dataset.pluginCss))) ?? null,
    createElement: () => ({ dataset: {}, textContent: "" }),
    head: { appendChild: (tag) => styles.push(tag) },
  };
}

test("the loader id is the package name — the host keys bundles by it", async () => {
  const { bundle } = await bootClient();
  assert.equal(bundle.id, packageJson.name);
  assert.equal(bundle.id, "dsh-soul");
});

test("the bundle asks for react, and probes the host switch without requiring it", async () => {
  const { required, plugin } = await bootClient();
  // `react` is mandatory. The primitives probe is optional by design: the loader
  // in this harness refuses it, the bundle must survive that refusal and fall
  // back to its own switch rather than lose the whole settings card.
  assert.deepEqual(required, ["react", "@deepseek-ai/dsh-client-ui-primitives"]);
  const { css } = plugin.__test;
  assert.match(css, /__sl_switchBtn/, "the fallback switch is styled");
});

test("the plugin declares slots, locale and configForms", async () => {
  const { plugin } = await bootClient();
  assert.deepEqual(plugin.inject, ["slots", "locale", "configForms"]);
  assert.equal(typeof plugin.apply, "function");
});

test("apply registers the settings card plus both switcher mounts, once each", async () => {
  const { plugin } = await bootClient();
  const scope = { getSnapshot: () => ({ status: "ready", value: { showPersonaSwitcher: true } }), subscribe: () => () => {} };
  const { slots } = applyClient(plugin, { scope });
  const names = slots.map((entry) => entry.meta.name);
  assert.deepEqual(names, [
    "plugins.row.config",
    "plugins.row.config",
    "conversation.session.header.actions",
    "conversation.hero.options",
  ]);
  // `<package>#<row id>` is what the plugin manager matches before it lets the
  // component row open a config page; a different string leaves it unclickable.
  // Both the current and the pre-0.2 row id are registered, so a profile that
  // has not been renamed keeps a clickable row.
  assert.deepEqual(slots.slice(0, 2).map((entry) => entry.meta.key), ["dsh-soul#dsh-soul", "dsh-soul#soul"]);
  assert.equal(slots[0].meta.locale, "dshSoul");
  assert.equal(slots[2].meta.id, "soul-persona");
  assert.equal(slots[3].meta.id, "soul-persona-hero");
  assert.deepEqual(slots.map((entry) => entry.meta.order), [undefined, undefined, 40, 40]);
});

test("the settings scope is bound to the `dsh-soul` namespace, once, for every mount", async () => {
  const { plugin } = await bootClient();
  const scope = { getSnapshot: () => ({ status: "ready", value: {} }), subscribe: () => () => {} };
  const { asks } = applyClient(plugin, { scope });
  const configAks = asks.filter((entry) => entry.configNs !== undefined);
  assert.deepEqual(configAks.map((entry) => entry.configNs), ["dsh-soul"]);
});

test("a profile still declaring the old `soul` row keeps working", async () => {
  const { plugin } = await bootClient();
  const pending = { getSnapshot: () => ({ status: "pending" }) };
  const ready = { getSnapshot: () => ({ status: "ready", value: { cards: { A: "x" } } }), subscribe: () => () => {} };
  // New namespace unresolved, old one ready: the old scope is the one used, so a
  // not-yet-renamed profile edits its own settings instead of showing nothing.
  const legacy = applyClient(plugin, { scope: (ns) => (ns === "soul" ? ready : pending) });
  assert.deepEqual(legacy.asks.filter((entry) => entry.configNs !== undefined).map((entry) => entry.configNs), ["dsh-soul", "soul"]);
  const panel = legacy.slots.find((slot) => slot.meta.name === "plugins.row.config").component({ view: "summary" });
  assert.equal(panel.props.scope, ready);
  // Neither resolved: the primary scope is returned anyway, so the card renders
  // its "unavailable" state instead of throwing.
  const none = applyClient(plugin, { scope: () => pending });
  assert.deepEqual(none.asks.filter((entry) => entry.configNs !== undefined).map((entry) => entry.configNs), ["dsh-soul", "soul"]);
  assert.equal(none.slots.find((slot) => slot.meta.name === "plugins.row.config").component({ view: "summary" }).props.scope, pending);
});

test("hiding the switcher at boot skips the hero registration only", async () => {
  const { plugin } = await bootClient();
  const scope = { getSnapshot: () => ({ status: "ready", value: { showPersonaSwitcher: false } }), subscribe: () => () => {} };
  const { slots } = applyClient(plugin, { scope });
  assert.deepEqual(slots.map((entry) => entry.meta.name), ["plugins.row.config", "plugins.row.config", "conversation.session.header.actions"]);
});

test("a scope that cannot be read at boot still registers everything", async () => {
  const { plugin } = await bootClient();
  const scope = { getSnapshot: () => { throw new Error("scope not ready"); } };
  const { slots } = applyClient(plugin, { scope });
  assert.equal(slots.length, 4);
});

test("both dictionaries carry exactly the same keys", async () => {
  const { plugin } = await bootClient();
  const { asks } = applyClient(plugin, { scope: null });
  const registered = asks.find((entry) => entry.ns === "dshSoul");
  assert.ok(registered, "the dictionary was never registered");
  const { zh, en } = registered.dicts;
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  assert.ok(Object.keys(zh).length > 40, "dictionary looks truncated");
});

test("every translation key the source uses exists in both dictionaries", async () => {
  const { plugin } = await bootClient();
  const { asks } = applyClient(plugin, { scope: null });
  const { zh, en } = asks.find((entry) => entry.ns === "dshSoul").dicts;
  const keys = new Set();
  // The lookbehind keeps `document.createElement("style")` from being read as a
  // translation call `t("style")`.
  for (const pattern of [/(?<![A-Za-z0-9_$])t\("([^"]+)"\)/g, /\bkey: "([^"]+)"/g, /\bdetailKey: "([^"]+)"/g]) {
    for (const match of source.matchAll(pattern)) keys.add(match[1]);
  }
  // Keys passed as bare strings rather than through `t(...)`.
  for (const extra of ["saved"]) keys.add(extra);
  assert.ok(keys.size > 30, `key scan found only ${keys.size} keys — the regexes drifted`);
  for (const key of keys) {
    assert.equal(typeof zh[key], "string", `zh.${key} is missing`);
    assert.equal(typeof en[key], "string", `en.${key} is missing`);
    assert.notEqual(zh[key].trim(), "", `zh.${key} is empty`);
    assert.notEqual(en[key].trim(), "", `en.${key} is empty`);
  }
});

test("no dictionary key is dead weight", async () => {
  const { plugin } = await bootClient();
  const { asks } = applyClient(plugin, { scope: null });
  const { zh } = asks.find((entry) => entry.ns === "dshSoul").dicts;
  const orphans = Object.keys(zh).filter((key) => !source.includes(`"${key}"`));
  assert.deepEqual(orphans, []);
});

test("the stylesheet uses its own class prefix exclusively", async () => {
  const { plugin } = await bootClient();
  const { css } = plugin.__test;
  assert.match(css, /__sl_root/);
  // Guards the vendored CSS block: a rule left on the original prefix would
  // silently style nothing. See the same-named note in client.js.
  assert.equal(/__sm_/.test(css), false, "the stylesheet still carries the original class prefix");
  assert.equal(/__sl_[a-zA-Z]+/.test(css), true);
});

test("the stylesheet is injected once, not once per apply", async () => {
  const doc = fakeDocument();
  const first = await bootClient({ document: doc });
  assert.equal(doc.styles.length, 1);
  assert.equal(doc.styles[0].dataset.plugin, "dsh-soul");
  assert.equal(doc.styles[0].dataset.pluginCss, "dsh-soul/main.css");
  assert.match(doc.styles[0].textContent, /__sl_root/);
  // A second load against the same document must find the tag and add nothing.
  await bootClient({ document: doc });
  assert.equal(doc.styles.length, 1);
  assert.ok(first);
});

test("the test seam exposes the write path and nothing else that could drift", async () => {
  const { plugin } = await bootClient();
  assert.deepEqual(Object.keys(plugin.__test).sort(), [
    "cardPreview", "commitSettingsOps", "css", "dictionaries", "holdComposer", "postJson", "reservedName", "settingsOpsApplied", "usableCardNames",
  ]);
});
