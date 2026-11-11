/**
 * Test harness for the dsh-soul client bundle.
 *
 * The bundle is a browser `__ModuleLoader__` factory with no export surface, so
 * the tests load the real source and drive the components through the real
 * registrations — no copy of the code under test.
 *
 * Three deliberate choices:
 *  - the source runs in THIS realm (`new Function`), not `vm.runInNewContext`:
 *    cross-realm arrays fail `deepStrictEqual` on prototypes, which would force
 *    every assertion down to scalars;
 *  - `fetch` is injected as a parameter of the wrapper function, so a test owns
 *    the network without touching globals;
 *  - React is a MINI hooks runtime that keeps state per mounted instance, so a
 *    two-click delete or an edit-then-rename really re-renders. A stub that
 *    ignores setState cannot test either.
 */
import { readFile } from "node:fs/promises";

const SOURCE_URL = new URL("../../client.js", import.meta.url);

/** A hooks runtime with per-instance state, refs and one-shot effects. */
export function createReact() {
  const instances = new Map();
  let current = null;
  const react = {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false) };
    },
    useState(initial) {
      // The instance must be captured HERE: a setter runs later, from an async
      // handler or an event, when `current` is no longer the rendering instance.
      const instance = current;
      const slot = instance.cursor++;
      if (!(slot in instance.states)) instance.states[slot] = typeof initial === "function" ? initial() : initial;
      return [instance.states[slot], (next) => {
        instance.states[slot] = typeof next === "function" ? next(instance.states[slot]) : next;
      }];
    },
    useRef(initial) {
      const slot = current.cursor++;
      if (!(slot in current.refs)) current.refs[slot] = { current: initial };
      return current.refs[slot];
    },
    useEffect(fn) {
      current.pendingEffects.push(fn);
    },
  };
  /**
   * Render one component function as instance `key`.
   *
   * `runEffects()` must be called AFTER the tree is read: effects in React run
   * after paint, and a component that subscribes inside an effect would
   * otherwise run against a half-rendered instance.
   */
  function mount(key, component, props) {
    const instance = instances.get(key) ?? { states: {}, refs: {}, pendingEffects: [], cursor: 0 };
    instances.set(key, instance);
    instance.cursor = 0;
    instance.pendingEffects = [];
    current = instance;
    const tree = component(props);
    current = null;
    const effects = instance.pendingEffects;
    instance.pendingEffects = [];
    const cleanups = [];
    return {
      tree,
      instance,
      cleanups,
      /** Run the effects collected by THIS render (cleanups are kept, not run). */
      runEffects() {
        for (const effect of effects) {
          const cleanup = effect();
          if (typeof cleanup === "function") cleanups.push(cleanup);
        }
        return this;
      },
      /** Re-render the same instance with new props; state and refs persist. */
      rerender(nextProps) {
        return mount(key, component, nextProps ?? props);
      },
    };
  }
  return { react, mount, instances };
}

/**
 * Boot the real client bundle.
 *
 * Returns the plugin module plus the registered slots and the injected context,
 * so each test asserts through the same seams the host uses.
 */
export async function bootClient({ fetch: fetchImpl, document: doc } = {}) {
  const source = await readFile(SOURCE_URL, "utf8");
  const { react, mount } = createReact();
  let bundle = null;
  const window = { __ModuleLoader__: { load(value) { bundle = value; } } };
  const required = [];
  const wrapper = new Function("window", "document", "fetch", "URL", "setTimeout", "clearTimeout", source);
  wrapper(window, doc, fetchImpl ?? (() => Promise.reject(new Error("no fetch in this test"))), URL, setTimeout, clearTimeout);
  if (!bundle) throw new Error("client.js did not call window.__ModuleLoader__.load");
  const plugin = bundle.factory((name) => {
    required.push(name);
    if (name !== "react") throw new Error(`unexpected module requested: ${name}`);
    return react;
  });
  return { bundle, plugin, mount, react, required };
}

/** Apply the bundle against a fake client context; returns what it registered. */
export function applyClient(plugin, { scope, localeDict = { zh: {}, en: {} }, configNs } = {}) {
  const slots = [];
  const asks = [];
  const ctx = {
    locale: {
      bind: (ns) => (key) => (localeDict.zh && localeDict.zh[key]) || key,
      register: (ns, dicts) => { asks.push({ ns, dicts }); return () => {}; },
    },
    effect: (fn) => {
      const dispose = typeof fn === "function" ? fn() : undefined;
      return typeof dispose === "function" ? dispose : () => {};
    },
    configForms: {
      // `scope` may be one scope or a lookup, so a test can give the new and the
      // legacy namespace different states.
      get: (ns) => {
        asks.push({ configNs: ns });
        return typeof scope === "function" ? scope(ns) : scope;
      },
    },
    slots: {
      inject: (name, fn) => fn(),
      register: (meta, component) => {
        slots.push({ meta, component });
        return () => {};
      },
    },
  };
  plugin.apply(ctx);
  return { ctx, slots, asks };
}

// ── settings scope fake ───────────────────────────────────────────────────

function writePath(root, path, op) {
  let node = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    if (node[path[i]] === null || typeof node[path[i]] !== "object") node[path[i]] = {};
    node = node[path[i]];
  }
  const leaf = path[path.length - 1];
  if (op.op === "unset") delete node[leaf];
  else node[leaf] = structuredClone(op.value);
}

/**
 * A settings scope that behaves like the host's: `mutate` applies the batch and
 * bumps the revision, so `settingsOpsApplied` sees the change and the UI reports
 * success. `refuse: true` resolves WITHOUT applying — that is exactly how a host
 * reacts to an operation it will not store (a non-volatile path, a revision
 * conflict), and it is the case a "settled ⇒ saved" UI gets wrong.
 */
/**
 * Deep-merge the composition layer under the user layer, so `value` models what
 * the host would resolve. A key the user layer never set survives; that is what
 * makes a base-layer card visible (and undeletable from the settings page).
 */
function mergeDeep(base, user) {
  if (user === undefined) return structuredClone(base);
  if (base === null || user === null || typeof base !== "object" || typeof user !== "object") return structuredClone(user);
  if (Array.isArray(base) || Array.isArray(user)) return structuredClone(user);
  const out = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(user)])) out[key] = mergeDeep(base[key], user[key]);
  return out;
}

export function makeScope(initial, options = {}) {
  let revision = 1;
  let user = structuredClone(initial);
  const base = options.base ? structuredClone(options.base) : {};
  let value = mergeDeep(base, user);
  const writes = [];
  return {
    writes,
    getSnapshot: () => ({ status: "ready", writable: options.writable !== false, revision, value, user }),
    subscribe: () => () => {},
    async mutate(ops, expectedRevision) {
      writes.push({ ops: structuredClone(ops), expectedRevision });
      if (options.refuse) {
        revision += 1;
        return true;
      }
      for (const op of ops) writePath(user, op.path, op);
      value = mergeDeep(base, user);
      revision += 1;
      return true;
    },
  };
}

// ── tree helpers ──────────────────────────────────────────────────────────

function walk(node, visit) {
  if (node === null || node === undefined || node === false) return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (typeof node !== "object") return;
  visit(node);
  walk(node.children, visit);
}

export function findAll(tree, predicate) {
  const out = [];
  walk(tree, (node) => { if (node.type && predicate(node)) out.push(node); });
  return out;
}

export function find(tree, predicate) {
  return findAll(tree, predicate)[0] ?? null;
}

/** All text inside a node, joined. */
export function textOf(node) {
  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node !== "object") return "";
  return textOf(node.children);
}

/** The single button whose label reads `label`. */
export function buttonByText(tree, label) {
  const buttons = findAll(tree, (node) => node.type === "button" && textOf(node).trim() === label);
  if (buttons.length !== 1) throw new Error(`expected exactly one button labelled ${JSON.stringify(label)}, found ${buttons.length}`);
  return buttons[0];
}

/** The single element of `type` whose own props match `shape`. */
export function one(tree, type, shape = {}) {
  const matches = findAll(tree, (node) => {
    if (node.type !== type) return false;
    return Object.entries(shape).every(([key, value]) => node.props[key] === value);
  });
  if (matches.length !== 1) throw new Error(`expected exactly one <${type}> matching ${JSON.stringify(shape)}, found ${matches.length}`);
  return matches[0];
}
