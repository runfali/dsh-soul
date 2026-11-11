/**
 * dsh-soul — client bundle.
 *
 * Hand-written `__ModuleLoader__` bundle (the host's own loader): no build step,
 * no ESM syntax, and `react` comes from the host through the factory's
 * `require`. `id` MUST equal the package name — the loader keys bundles by it.
 *
 * Three surfaces, one settings scope:
 *   plugins.bundle.config              the settings card
 *   conversation.session.header.actions the per-session switcher (chat header)
 *   conversation.hero.options           the same switcher on the new-session page
 *
 * The scope is bound ONCE and shared. Two binds would keep two revision
 * bookkeeping queues over one host document, so a write from the header could
 * be fenced against a revision the settings card had already superseded.
 */
window.__ModuleLoader__.load({
  id: "dsh-soul",
  factory: function (require) {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var react = require("react");
    var h = react.createElement;

    // ── CSS (theme tokens only, so light/dark follow the host) ─────────────
    var CSS = ".__sl_root{max-width:640px;display:flex;flex-direction:column;gap:10px}" +
      ".__sl_field{display:flex;flex-direction:column;gap:4px}" +
      ".__sl_label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px}" +
      ".__sl_hint{font-size:11px;color:var(--dsw-alias-label-tertiary)}" +
      ".__sl_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font-size:13px;box-sizing:border-box;width:100%}" +
      ".__sl_textarea{min-height:160px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.6}" +
      ".__sl_row{display:flex;align-items:center;gap:8px}" +
      ".__sl_check{accent-color:var(--dsw-alias-state-business-primary)}" +
      ".__sl_actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px}" +
      ".__sl_btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}" +
      ".__sl_btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}" +
      ".__sl_btn:disabled{opacity:.5;cursor:default}" +
      ".__sl_btnPrimary{border-color:var(--dsw-alias-state-business-primary, #3964fe);background:var(--dsw-alias-state-business-primary, #3964fe);color:#fff}" +
      ".__sl_btnDanger{border-color:var(--dsw-alias-state-error-primary, #f85149);color:var(--dsw-alias-state-error-primary, #f85149)}" +
      ".__sl_status{font-size:12px;color:var(--dsw-alias-label-tertiary)}" +
      ".__sl_error{font-size:12px;color:var(--dsw-alias-state-error-primary)}" +
      ".__sl_unavailable{font-size:13px;color:var(--dsw-alias-label-tertiary)}" +
      ".__sl_group{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}" +
      ".__sl_cardList{display:flex;flex-direction:column;gap:6px}" +
      ".__sl_cardRow{display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 10px;flex-wrap:wrap}" +
      ".__sl_cardName{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".__sl_cardPreview{font-size:11px;color:var(--dsw-alias-label-tertiary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".__sl_badge{border:1px solid var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);border-radius:999px;padding:0 8px;font-size:10px;white-space:nowrap}" +
      ".__sl_switch{display:inline-flex;align-items:center;gap:6px;font-size:12px;margin-right:8px}" +
      ".__sl_switchLabel{color:var(--dsw-alias-label-tertiary);white-space:nowrap}" +
      ".__sl_switchSelect{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:3px 6px;font:inherit;font-size:12px;max-width:180px}" +
      ".__sl_switchHero{margin-right:0;min-width:0}" +
      ".__sl_switchHero .__sl_switchSelect{max-width:140px;min-width:0}";
    // Scoped flat controls retain native keyboard and form behavior.
    CSS += `
.dsh-flat.__sl_root{width:100%;max-width:720px;gap:14px;font-size:13px;line-height:1.65;color:var(--dsw-alias-label-primary);--flat-accent:var(--dsw-alias-state-business-primary,#3964fe);--flat-border:var(--dsw-alias-border-l2,#dce2eb)}
.dsh-flat.__sl_root *{box-sizing:border-box;min-width:0}
.dsh-flat.__sl_root p{margin:0}
.dsh-flat.__sl_root label[class$="_field"]{gap:7px}
.dsh-flat.__sl_root [class$="_label"]{font-size:13px;font-weight:500}
.dsh-flat.__sl_root [class$="_hint"]{font-size:12px;line-height:1.65}
.dsh-flat.__sl_root input:not([type=checkbox]),.dsh-flat.__sl_root select,.dsh-flat.__sl_root textarea{width:100%;border:1px solid var(--flat-border);border-radius:6px;background:var(--dsw-alias-bg-layer-3);color:inherit;font:inherit;padding:9px 12px;min-height:40px;box-shadow:none;transition:border-color .15s}
.dsh-flat.__sl_root input:hover:not(:disabled),.dsh-flat.__sl_root select:hover:not(:disabled),.dsh-flat.__sl_root textarea:hover:not(:disabled){border-color:var(--dsw-alias-label-tertiary)}
.dsh-flat.__sl_root select{appearance:none;padding-right:34px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='m2 2 4 4 4-4' fill='none' stroke='%23778091' stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
.dsh-flat.__sl_root input[type=checkbox]{appearance:none;flex:none;width:30px;height:18px;margin:0;border:1px solid var(--flat-border);border-radius:12px;background:var(--dsw-alias-bg-layer-2);position:relative;cursor:pointer;transition:background .15s,border-color .15s}
.dsh-flat.__sl_root input[type=checkbox]::before{content:"";position:absolute;left:2px;top:2px;width:12px;height:12px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .15s}
.dsh-flat.__sl_root input[type=checkbox]:checked{background:var(--flat-accent);border-color:var(--flat-accent)}
.dsh-flat.__sl_root input[type=checkbox]:checked::before{transform:translateX(12px);background:#fff}
.dsh-flat.__sl_root :is(input,select,textarea,button,summary,a):focus-visible{outline:2px solid var(--flat-accent);outline-offset:3px}
.dsh-flat.__sl_root :is(input,select,textarea,button):disabled{opacity:.5;cursor:default}
.dsh-flat.__sl_root [class$="_actions"]{flex-wrap:wrap;gap:10px;margin-top:4px;padding-top:16px;border-top:1px solid var(--flat-border)}
.dsh-flat.__sl_root .__sl_group{border:0;border-top:1px solid var(--flat-border);border-radius:0;padding:20px 0 0;gap:14px}
.dsh-flat.__sl_root .__sl_cardRow{flex-wrap:wrap;border:0;border-bottom:1px solid var(--flat-border);border-radius:0;padding:10px 0;background:none}
.dsh-flat.__sl_root .__sl_cardPreview{flex-basis:100%;order:2}
.dsh-flat.__sl_root .__sl_textarea{font-family:ui-monospace,Consolas,monospace;line-height:1.7;min-height:180px;resize:vertical}
@media(max-width:480px){.dsh-flat.__sl_root{gap:16px}.dsh-flat.__sl_root .__sl_cardRow{gap:8px}}
@media(prefers-reduced-motion:reduce){.dsh-flat.__sl_root *,.dsh-flat.__sl_root input[type=checkbox]::before{transition:none}}
.dsh-flat.__sl_root button{border-radius:6px;min-height:34px;padding:7px 14px;font:inherit;font-size:12px;box-shadow:none}
`;
    var tagId = "dsh-soul/main.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-soul";
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ── locale ─────────────────────────────────────────────────────────────
    var NS = "dshSoul";
    var inject = ["slots", "locale", "configForms"];
    /** The settings namespace this card edits (== the cordis.patch.yml row id). */
    var CONFIG_NS = "soul";
    /** The bundle key the host resolves the settings card by. */
    var BUNDLE_KEY = "dsh-soul";
    var WORKSPACES_URL = "/api/soul/workspaces";
    /** The only payload shape this build renders. */
    var WIRE_VERSION = 1;
    var NET_TIMEOUT_MS = 8000;
    /** The stored value that means "explicitly no persona". */
    var CHOICE_NONE = "none";

    var zh = {
      intro: "人设卡的内容会注入系统提示词，按 会话选择 → 工作区选择 → 默认卡 的顺序取一个。卡片由你独写，模型只能读。",
      unavailable: "这个宿主版本没有提供插件设置接口，人设卡暂时无法在这里编辑。",
      loading: "正在读取设置…",
      saving: "正在保存…",
      saved: "已保存",
      notApplied: "宿主没有接受这次修改，已按它当前保存的内容刷新；你刚输入的文字还在。",
      error: "出错了",
      cancel: "取消",

      cardListTitle: "人设卡",
      cardListHint: "聊天标题栏和新会话页都能给单个会话换卡；改这里只动卡片本身。",
      noCards: "还没有人设卡，在下面新建一张。",
      defaultBadge: "默认",
      editCard: "编辑",
      setDefault: "设为默认",
      deleteCard: "删除",
      confirmDeleteShort: "再点一次删除",
      cardName: "卡片名称",
      cardNameHint: "只能用来区分卡片，不会出现在提示词里。",
      cardNamePlaceholder: "例如：大肥鱼",
      cardContent: "卡片内容",
      cardContentHint: "原样注入系统提示词，不解析变量。",
      saveCard: "保存卡片",
      newCard: "新建卡片",
      invalidCardName: "请输入卡片名称",
      invalidCardContent: "请输入卡片内容",
      reservedCardName: "这个名称是 JavaScript 的保留属性名（如 __proto__、constructor），用作卡名会被吞掉，请换一个",
      cardExists: "已存在同名人设卡；改名会覆盖它，请先删除或换个名字",

      workspaceTitle: "按工作区指定人设",
      workspaceHint: "打开某个工作区的会话时，优先用它指定的卡。单个会话的选择仍然优先于这里。",
      workspaceEmpty: "宿主还没有登记工作区。",
      workspaceUnavailable: "读不到宿主的工作区列表。",
      workspaceStale: "这个工作区已不在列表里",
      refresh: "刷新",
      followDefault: "跟随默认",
      offOption: "关闭人设",

      optionsTitle: "选项",
      fieldShowPersonaSwitcher: "显示会话人设选择器",
      showPersonaSwitcherHint: "关闭后聊天标题栏和新会话页都不显示，已保存的会话选择不受影响。",
      fieldSkipSubagents: "子会话不注入人设",
      skipSubagentsHint: "被委派的子会话继承父会话的上下文，重复注入既费 token 又容易串味。",

      switchLabel: "人设",
      switchTitle: "给这个会话单独指定人设卡",
      autoOption: "跟随默认",
      noneOption: "关闭人设",
    };

    var en = {
      intro: "Card text is injected into the system prompt. Order: session choice, then workspace choice, then the default card. Cards are yours to write; the model can only read them.",
      unavailable: "This host version exposes no plugin settings API, so persona cards cannot be edited here.",
      loading: "Reading settings…",
      saving: "Saving…",
      saved: "Saved",
      notApplied: "The host did not accept this change and the card now shows what it actually holds. Your text is still in the form.",
      error: "Error",
      cancel: "Cancel",

      cardListTitle: "Persona cards",
      cardListHint: "The chat header and the new-session page switch one session's card; this list edits the cards themselves.",
      noCards: "No cards yet — create one below.",
      defaultBadge: "default",
      editCard: "Edit",
      setDefault: "Make default",
      deleteCard: "Delete",
      confirmDeleteShort: "Click again to delete",
      cardName: "Card name",
      cardNameHint: "Only identifies the card; it never reaches the prompt.",
      cardNamePlaceholder: "e.g. BigFish",
      cardContent: "Card content",
      cardContentHint: "Injected verbatim; variables are not interpolated.",
      saveCard: "Save card",
      newCard: "New card",
      invalidCardName: "Enter a card name",
      invalidCardContent: "Enter card content",
      reservedCardName: "This name is a JavaScript prototype property (__proto__, constructor, …) and would be swallowed — pick another",
      cardExists: "A card with that name already exists; renaming would overwrite it, so delete it first or pick another name",

      workspaceTitle: "Persona per workspace",
      workspaceHint: "A session opened in this workspace uses the card chosen here. A per-session choice still wins.",
      workspaceEmpty: "The host has no workspaces registered yet.",
      workspaceUnavailable: "The host's workspace list could not be read.",
      workspaceStale: "no longer in the list",
      refresh: "Refresh",
      followDefault: "Follow default",
      offOption: "No persona",

      optionsTitle: "Options",
      fieldShowPersonaSwitcher: "Show the session persona switcher",
      showPersonaSwitcherHint: "Turning this off hides it in the chat header and on the new-session page; saved session choices are kept.",
      fieldSkipSubagents: "Skip the persona in child sessions",
      skipSubagentsHint: "Delegated sessions inherit their parent's context; injecting the same persona again costs tokens and blurs scope.",

      switchLabel: "Persona",
      switchTitle: "Give this session its own persona card",
      autoOption: "Follow default",
      noneOption: "No persona",
    };

    // ── helpers ────────────────────────────────────────────────────────────
    /** Follow the host language without remounting, so drafts survive a switch. */
    function useLocale(locale) {
      var refresh = react.useState(0)[1];
      react.useEffect(function () {
        if (!locale || typeof locale.subscribe !== "function") return;
        return locale.subscribe(function () { refresh(function (revision) { return revision + 1; }); });
      }, [locale]);
    }

    function messageText(t, message) {
      if (!message) return "";
      // `detail` is APPENDED, not an alternative to `detailKey`: a message can
      // name the failure and the host's own words at once.
      var text = t(message.key) + (message.detailKey ? ": " + t(message.detailKey) : "");
      return message.detail ? text + " (" + message.detail + ")" : text;
    }

    function plainObject(value) {
      return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
    }

    /** Card names usable as a choice: content must be a non-blank string. */
    function usableCardNames(cards) {
      var map = plainObject(cards);
      return Object.keys(map).filter(function (cardName) {
        return typeof map[cardName] === "string" && map[cardName].trim() !== "";
      }).sort();
    }

    /**
     * `Object.assign` cannot create an OWN `__proto__`/`constructor` key — the
     * prototype accessor swallows the write — so such a card would silently stay
     * absent while the form reported "saved". Refuse the name up front.
     */
    function reservedName(cardName) {
      return Object.hasOwn(Object.prototype, cardName) || cardName === "prototype";
    }

    /** First non-empty line of a card, short enough for a list row. */
    function cardPreview(text) {
      var line = String(text || "").split(/\r?\n/).filter(function (part) { return part.trim() !== ""; })[0] || "";
      line = line.trim();
      return line.length > 64 ? line.slice(0, 64) + "…" : line;
    }

    /**
     * Whether a namespace section now reflects every queued operation.
     *
     * A settled write says nothing about whether it was APPLIED: the scope
     * contract is "settle after the write and any recovery read", so a write the
     * host refused with a revision conflict still resolves. Inspecting the
     * section afterwards is the only way to tell a committed change from a
     * refused one.
     *
     * `op.path` may address a nested field (`["cards", name]`), so read it
     * segment by segment; reading `path[0]` would compare the whole map against
     * a single field value and reject every nested write.
     *
     * A dict-valued write is a WHOLE-VALUE claim, not a patch: the key sets must
     * match in both directions, or a removal would be unverifiable (the removed
     * key is simply never inspected).
     */
    function settingsOpsApplied(snapshot, ops) {
      if (!snapshot || snapshot.status !== "ready" || snapshot.value === void 0) return false;
      var user = snapshot.user && typeof snapshot.user === "object" ? snapshot.user : {};
      function at(root, path) {
        var node = root;
        for (var i = 0; i < path.length; i++) {
          if (node === null || typeof node !== "object") return void 0;
          node = node[path[i]];
        }
        return node;
      }
      function same(actual, expected) {
        if (expected === null || typeof expected !== "object" || Array.isArray(expected)) {
          return JSON.stringify(actual) === JSON.stringify(expected);
        }
        if (actual === null || typeof actual !== "object" || Array.isArray(actual)) return false;
        var expectedKeys = Object.keys(expected);
        if (expectedKeys.length !== Object.keys(actual).length) return false;
        return expectedKeys.every(function (field) {
          return Object.prototype.hasOwnProperty.call(actual, field)
            && JSON.stringify(actual[field]) === JSON.stringify(expected[field]);
        });
      }
      for (var i = 0; i < ops.length; i++) {
        var op = ops[i];
        var leaf = op.path[op.path.length - 1];
        var parent = at(user, op.path.slice(0, -1));
        if (op.op === "unset") {
          if (parent !== void 0 && parent !== null && typeof parent === "object"
            && Object.prototype.hasOwnProperty.call(parent, leaf)) return false;
        } else if (!same(at(snapshot.value, op.path), op.value)) {
          return false;
        }
      }
      return true;
    }

    /**
     * Apply one batch of namespace operations; resolves whether it took effect.
     *
     * One mutate() carries one revision fence and one persistence decision for
     * the whole batch. The same changes as separate set()/unset() calls give each
     * its own fence, and a fence behind the host document is refused — so an edit
     * could be rejected while the UI still reported success. Hosts without
     * mutate() apply the operations in order, each waiting for its predecessor,
     * which keeps the revision chain intact; never in parallel.
     */
    function commitSettingsOps(scope, ops) {
      if (ops.length === 0) return Promise.resolve(true);
      var snapshot = scope.getSnapshot();
      // The host SPLICES on an array unset: the tail shifts down, so "the index
      // is gone" is the wrong postcondition and a committed splice reads as
      // refused. No caller unsets an array element today, so refuse one up front
      // instead of guessing.
      for (var i = 0; i < ops.length; i++) {
        var path = ops[i].path;
        if (ops[i].op !== "unset" || path.length < 2) continue;
        var node = snapshot.value;
        for (var step = 0; node !== null && typeof node === "object" && step < path.length - 1; step++) node = node[path[step]];
        if (Array.isArray(node)) {
          return Promise.reject(new Error("unset of an array element is not supported: " + path.join(".")));
        }
      }
      var run;
      if (typeof scope.mutate === "function") {
        run = scope.mutate(ops, snapshot.revision);
      } else {
        run = ops.reduce(function (chain, op) {
          return chain.then(function () {
            var key = op.path[0];
            if (op.path.length === 1) {
              return op.op === "unset" ? scope.unset(key) : scope.set(key, op.value);
            }
            // `set(path[0], value)` on a nested path replaces the whole object
            // (`cards: true`) and drops every other card. Merge the leaf into the
            // top-level object instead, read from `snapshot.user` — the resolved
            // `value` carries schema defaults, and writing those back would pin
            // them in the user document.
            if (op.path.length > 2) {
              return Promise.reject(new Error("unsupported nested path without mutate(): " + op.path.join(".")));
            }
            var user = scope.getSnapshot().user;
            var current = user !== null && typeof user === "object" ? user[key] : void 0;
            if (Array.isArray(current)) {
              return Promise.reject(new Error("unsupported array write without mutate(): " + op.path.join(".")));
            }
            var next = Object.assign({}, current !== null && typeof current === "object" ? current : null);
            if (op.op === "unset") delete next[op.path[1]];
            else next[op.path[1]] = op.value;
            return scope.set(key, next);
          });
        }, Promise.resolve());
      }
      return Promise.resolve(run).then(function () {
        return settingsOpsApplied(scope.getSnapshot(), ops);
      });
    }

    /**
     * POST JSON to one of this plugin's read-only endpoints.
     *
     * Resolves `{ status: "ready", payload }` / `{ status: "unavailable", reason }`
     * / `{ status: "error", detail }`. A JSON content type is REQUIRED by the
     * endpoint (it is what blocks a cross-site form post), so it is always set.
     * The timer settles the promise even when fetch ignores the abort signal,
     * so a dead endpoint cannot leave a button spinning forever.
     */
    function postJson(url, body) {
      if (typeof fetch !== "function") return Promise.resolve({ status: "unavailable", reason: "no-fetch" });
      var controller = typeof AbortController === "function" ? new AbortController() : null;
      var init = {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {}),
        credentials: "same-origin",
      };
      if (controller) init.signal = controller.signal;
      var timer = null;
      var timeout = new Promise(function (resolve) {
        timer = setTimeout(function () { resolve({ status: "error", detail: "timeout" }); }, NET_TIMEOUT_MS);
      });
      var request = fetch(url, init)
        .then(function (response) {
          if (response.status === 401 || response.status === 404) return { status: "unavailable", reason: "http-" + response.status };
          if (!response.ok) return { status: "error", detail: "http-" + response.status };
          return response.json().then(function (payload) {
            if (!payload || typeof payload !== "object" || payload.version !== WIRE_VERSION) {
              return { status: "unavailable", reason: "version" };
            }
            return { status: "ready", payload: payload };
          });
        })
        .catch(function (error) {
          return { status: "error", detail: String(error && error.message || error) };
        });
      return Promise.race([request, timeout]).then(function (result) {
        if (timer) clearTimeout(timer);
        if (controller && result.status !== "ready") {
          try { controller.abort(); } catch { /* already settled */ }
        }
        return result;
      });
    }

    /**
     * The host exposes one composer block per session, shared with other plugins.
     * Never replace someone else's block or clear one this call does not own.
     */
    function holdComposer(blocks, sessionId, reason) {
      if (!blocks || typeof blocks.storeFor !== "function" || typeof blocks.set !== "function") return function () {};
      var store = blocks.storeFor(sessionId);
      if (!store || typeof store.getSnapshot !== "function" || typeof store.subscribe !== "function") return function () {};
      var block = { reason: reason };
      var active = true;
      var ensure = function () { if (active && store.getSnapshot() === void 0) blocks.set(sessionId, block); };
      var unsubscribe = store.subscribe(ensure);
      ensure();
      return function () {
        if (!active) return;
        active = false;
        unsubscribe();
        if (store.getSnapshot() === block) blocks.set(sessionId, undefined);
      };
    }

    // ── per-session persona switcher ───────────────────────────────────────
    function PersonaSwitcher(props) {
      useLocale(props.locale);
      var t = props.t;
      var scope = props.scope;
      var sessionId = props.sessionId;
      var [snapshot, setSnapshot] = react.useState(function () {
        return scope && typeof scope.getSnapshot === "function" ? scope.getSnapshot() : { status: "ready", value: {} };
      });
      var [busy, setBusy] = react.useState(false);
      var [error, setError] = react.useState(null);
      var writePending = react.useRef(false);
      react.useEffect(function () {
        // No refresh call: the scope's public seam has no load(). Reads ride the
        // shared describe mirror, which re-reads on every host
        // `settings/document-updated`.
        var alive = true;
        var sync = function () { if (alive && scope && typeof scope.getSnapshot === "function") setSnapshot(scope.getSnapshot()); };
        var un = scope && typeof scope.subscribe === "function" ? scope.subscribe(sync) : null;
        // Unmounting must only unsubscribe — never dispose the scope, or a later
        // remount finds a disposed scope whose write queue no-ops.
        return function () { alive = false; if (un) un(); };
      }, [scope]);
      var ready = snapshot.status === "ready" && snapshot.value !== void 0;
      if (!ready || !sessionId) return null;
      var writable = snapshot.writable !== false;
      var value = snapshot.value;
      if (value.showPersonaSwitcher === false) return null;
      var cards = plainObject(value.cards);
      var sessions = plainObject(value.sessions);
      var names = usableCardNames(cards);
      var choice = typeof sessions[sessionId] === "string" ? sessions[sessionId] : "";
      // A stored choice that names a card which is gone (or blank) reads as "no
      // choice", not as a live selection of a card nothing can show.
      if (choice && choice !== CHOICE_NONE && names.indexOf(choice) === -1) choice = "";
      function onChange(e) {
        if (writePending.current || !writable) return;
        writePending.current = true;
        setBusy(true);
        setError(null);
        var next = e.target.value;
        // One session, one key: writing the whole map would pin every other
        // session's choice from a lower layer into the user layer.
        var ops = next === ""
          ? [{ op: "unset", path: ["sessions", sessionId] }]
          : [{ op: "set", path: ["sessions", sessionId], value: next }];
        // The new-session page shares one composer block per session with other
        // plugins: hold it while the choice saves so the page does not let the
        // user type into a session whose persona is still settling.
        var release = null;
        if (props.hero && typeof props.holdComposer === "function") release = props.holdComposer(sessionId, "saving");
        commitSettingsOps(scope, ops).then(function (ok) {
          if (release) release();
          writePending.current = false;
          setBusy(false);
          setSnapshot(scope.getSnapshot());
          if (!ok) setError({ key: "error", detailKey: "notApplied" });
        }).catch(function (e) {
          if (release) release();
          writePending.current = false;
          setBusy(false);
          setSnapshot(scope.getSnapshot());
          setError({ key: "error", detail: String(e && e.message || e) });
        });
      }
      return h("label", { className: "__sl_switch" + (props.hero ? " __sl_switchHero" : ""), title: t("switchTitle") },
        h("span", { className: "__sl_switchLabel" }, t("switchLabel")),
        h("select", { className: "__sl_switchSelect", value: choice, disabled: busy || !writable, onChange: onChange },
          h("option", { value: "" }, t("autoOption")),
          h("option", { value: CHOICE_NONE }, t("noneOption")),
          names.map(function (cardName) {
            return h("option", { key: cardName, value: cardName }, cardName);
          })
        ),
        error ? h("span", { className: "__sl_error", role: "alert" }, messageText(t, error)) : null
      );
    }

    // ── settings card ─────────────────────────────────────────────────────
    function SoulSection(props) {
      useLocale(props.locale);
      var t = props.t;
      var scope = props.scope;
      var [snapshot, setSnapshot] = react.useState(function () {
        // An old host may not hand over a settings scope at all; the form must
        // render (disabled-ish) instead of crashing on first paint.
        return scope && typeof scope.getSnapshot === "function" ? scope.getSnapshot() : { status: "ready", value: {} };
      });
      var ready = snapshot.status === "ready" && snapshot.value !== void 0;
      // `writable: false` means this profile refuses writes; an older host omits
      // it, which reads as writable.
      var writable = snapshot.writable !== false;
      var [cardDraft, setCardDraft] = react.useState({ name: "", content: "" });
      /** The card this form was loaded from via 编辑 ("" = a new card). */
      var [editing, setEditing] = react.useState("");
      /** Card name awaiting the second click of the inline delete confirmation. */
      var [confirming, setConfirming] = react.useState("");
      /** Which group is writing right now ("" = none). Writes stay serialized. */
      var [busyGroup, setBusyGroup] = react.useState("");
      var writePending = react.useRef(false);
      var [notice, setNotice] = react.useState(null);
      var [error, setError] = react.useState(null);
      /** Workspace candidates from the read-only endpoint; null = not read yet. */
      var [wsOptions, setWsOptions] = react.useState(null);
      var [wsFailed, setWsFailed] = react.useState(false);
      var wsAlive = react.useRef(false);

      react.useEffect(function () {
        var alive = true;
        var sync = function () { if (alive && scope && typeof scope.getSnapshot === "function") setSnapshot(scope.getSnapshot()); };
        var un = scope && typeof scope.subscribe === "function" ? scope.subscribe(sync) : null;
        return function () { alive = false; if (un) un(); };
      }, [scope]);

      function loadWorkspaces() {
        if (typeof fetch !== "function") return;
        postJson(WORKSPACES_URL, {}).then(function (result) {
          if (!wsAlive.current) return;
          // A payload this build cannot read is not an empty list: rendering
          // "you have no workspaces" over a mapping the user already made hides
          // it and leaves it uneditable.
          if (result.status === "ready" && Array.isArray(result.payload.workspaces)) {
            setWsOptions(result.payload.workspaces);
            setWsFailed(false);
            return;
          }
          setWsFailed(true);
        });
      }
      react.useEffect(function () {
        wsAlive.current = true;
        return function () { wsAlive.current = false; };
      }, []);
      react.useEffect(function () { loadWorkspaces(); }, [snapshot.revision]);

      // The root element is a `fieldset`, so `writable: false` disables every
      // descendant natively. A write in flight locks only the group that is
      // writing: disabling the whole form made typing in another group lose
      // focus mid-IME and printed "saving" under a form that was not saving.
      var busy = busyGroup !== "";

      function clearFeedback(group) {
        setNotice(function (current) { return current && current.group === group ? null : current; });
        setError(function (current) { return current && current.group === group ? null : current; });
      }

      function feedbackOf(group) {
        return {
          notice: notice && notice.group === group ? notice : null,
          error: error && error.group === group ? error : null,
        };
      }

      /**
       * One write path for every group.
       *
       * Reports success only when the namespace section confirms the change, so
       * a refused write cannot masquerade as "saved"; on failure the form is
       * reloaded from whatever the host actually holds. `group` rides the
       * feedback so "saved" from the card form never appears under the
       * workspace or options groups.
       */
      function runWrite(ops, onOk, group) {
        if (writePending.current || !writable) return;
        writePending.current = true;
        setBusyGroup(group);
        clearFeedback(group);
        commitSettingsOps(scope, ops).then(function (ok) {
          writePending.current = false;
          setBusyGroup("");
          setSnapshot(scope.getSnapshot());
          if (!ok) {
            // Every group keeps its draft on a refusal: the host said no, so the
            // text the user just typed is still theirs to retry.
            setError({ key: "error", detailKey: "notApplied", group: group });
            return;
          }
          setNotice({ key: "saved", group: group });
          if (onOk) onOk();
        }).catch(function (e) {
          writePending.current = false;
          setBusyGroup("");
          setSnapshot(scope.getSnapshot());
          setError({ key: "error", detail: String(e && e.message || e), group: group });
        });
      }

      if (snapshot.status === "unavailable") {
        return h("p", { className: "__sl_unavailable" }, t("unavailable"));
      }
      if (!ready) return h("p", { className: "__sl_status" }, t("loading"));

      var value = plainObject(snapshot.value);
      var cards = plainObject(value.cards);
      var names = usableCardNames(cards);
      var active = typeof value.active === "string" ? value.active : "";
      var wsMap = plainObject(value.workspaces);
      var wsList = Array.isArray(wsOptions) ? wsOptions : [];
      var listed = {};
      wsList.forEach(function (entry) { if (entry && typeof entry.path === "string") listed[entry.path] = true; });
      // A mapping whose workspace has been deleted is invisible in a registry-
      // driven list, so it could never be cleared again.
      var staleKeys = Object.keys(wsMap).filter(function (key) { return !listed[key]; });

      function onSaveCard() {
        var nextName = String(cardDraft.name || "").trim();
        var content = String(cardDraft.content || "");
        if (!nextName) { setError({ key: "error", detailKey: "invalidCardName", group: "cards" }); return; }
        if (reservedName(nextName)) { setError({ key: "error", detailKey: "reservedCardName", group: "cards" }); return; }
        if (!content.trim()) { setError({ key: "error", detailKey: "invalidCardContent", group: "cards" }); return; }
        // Renaming an edited card onto an existing one would overwrite that card
        // with no backup (the card is user-owned; nothing else keeps a copy).
        if (editing && editing !== nextName && Object.hasOwn(cards, nextName)) {
          setError({ key: "error", detailKey: "cardExists", detail: nextName, group: "cards" });
          return;
        }
        var ops = [{ op: "set", path: ["cards", nextName], value: content }];
        // An in-place rename MOVES the card: one batch, so a refused write can
        // never leave the content in two cards or in neither.
        if (editing && editing !== nextName) ops.push({ op: "unset", path: ["cards", editing] });
        runWrite(ops, function () {
          setCardDraft({ name: "", content: "" });
          setEditing("");
        }, "cards");
      }

      function onEditCard(cardName) {
        setCardDraft({ name: cardName, content: cards[cardName] || "" });
        setEditing(cardName);
        setConfirming("");
        clearFeedback("cards");
      }

      function onCancelEdit() {
        setCardDraft({ name: "", content: "" });
        setEditing("");
        clearFeedback("cards");
      }

      /**
       * Two clicks, no `window.confirm`: a blocking dialog is not the host's
       * pattern and a webview that does not implement it turns the delete button
       * into an uncaught TypeError.
       */
      function onDeleteCard(cardName) {
        if (confirming !== cardName) {
          setConfirming(cardName);
          clearFeedback("cards");
          return;
        }
        setConfirming("");
        if (editing === cardName) {
          setEditing("");
          setCardDraft({ name: "", content: "" });
        }
        // Deleting the active card also clears `active`. Both edits go in ONE
        // batch: as two writes each carried its own revision fence and the second
        // could be refused for a revision the first had just superseded.
        var ops = [{ op: "unset", path: ["cards", cardName] }];
        if (cardName === active) ops.push({ op: "unset", path: ["active"] });
        runWrite(ops, null, "cards");
      }

      function onSetActive(cardName) {
        setConfirming("");
        runWrite([{ op: "set", path: ["active"], value: cardName }], null, "cards");
      }

      function onWsChange(path, next) {
        setConfirming("");
        // ONE key per write. A whole-map write pins every mapping inherited from
        // the composition layer into the user layer.
        var ops = next === ""
          ? [{ op: "unset", path: ["workspaces", path] }]
          : [{ op: "set", path: ["workspaces", path], value: next }];
        runWrite(ops, null, "workspace");
      }

      function onToggleFlag(key, checked) {
        runWrite([{ op: "set", path: [key], value: checked }], null, "flags");
      }

      function renderSwitchRow(key, labelKey, hintKey, current) {
        return h("label", { key: key, className: "__sl_field" },
          h("span", { className: "__sl_row" },
            h("input", { className: "__sl_check", type: "checkbox", checked: current, disabled: busy || !writable, onChange: function (e) { onToggleFlag(key, e.target.checked); } }),
            h("span", { className: "__sl_label" }, t(labelKey))
          ),
          h("span", { className: "__sl_hint" }, t(hintKey))
        );
      }

      function renderWsRow(path, title, stale) {
        var current = typeof wsMap[path] === "string" ? wsMap[path] : "";
        // A saved choice naming a card that no longer exists must not look like
        // "follow default" while it still suppresses the default card.
        var missing = current !== "" && current !== CHOICE_NONE && !Object.hasOwn(cards, current);
        return h("div", { key: path, className: "__sl_cardRow" },
          h("span", { className: "__sl_cardName" }, title || path),
          stale ? h("span", { className: "__sl_badge" }, t("workspaceStale")) : null,
          h("span", { className: "__sl_cardPreview" }, path),
          h("select", {
            className: "__sl_input",
            value: current,
            disabled: busy || !writable,
            onChange: function (e) { onWsChange(path, e.target.value); },
          },
            h("option", { value: "" }, t("followDefault")),
            h("option", { value: CHOICE_NONE }, t("offOption")),
            missing ? h("option", { value: current }, current + " (" + t("workspaceStale") + ")") : null,
            names.map(function (cardName) { return h("option", { key: cardName, value: cardName }, cardName); })
          )
        );
      }

      var cardsFeedback = feedbackOf("cards");
      var wsFeedback = feedbackOf("workspace");
      var flagsFeedback = feedbackOf("flags");

      return h("fieldset", {
        className: "__sl_root dsh-flat",
        disabled: !writable,
        style: { border: 0, margin: 0, padding: 0, minWidth: 0 },
      },
        h("p", { className: "__sl_hint", style: { margin: "0 0 4px" } }, t("intro")),

        // ── cards ─────────────────────────────────────────────────────────
        h("fieldset", { className: "__sl_group", disabled: busyGroup === "cards", style: { border: 0, margin: 0, padding: 0, minWidth: 0 } },
          h("p", { className: "__sl_label", style: { margin: 0 } }, t("cardListTitle")),
          h("p", { className: "__sl_hint", style: { margin: 0 } }, t("cardListHint")),
          names.length === 0
            ? h("p", { className: "__sl_status" }, t("noCards"))
            : h("div", { className: "__sl_cardList" }, names.map(function (cardName) {
              return h("div", { key: cardName, className: "__sl_cardRow" },
                h("span", { className: "__sl_cardName" }, cardName),
                cardName === active ? h("span", { className: "__sl_badge" }, t("defaultBadge")) : null,
                h("span", { className: "__sl_cardPreview" }, cardPreview(cards[cardName])),
                h("button", { type: "button", className: "__sl_btn", onClick: function () { onEditCard(cardName); }, disabled: busy }, t("editCard")),
                cardName === active ? null : h("button", { type: "button", className: "__sl_btn", onClick: function () { onSetActive(cardName); }, disabled: busy }, t("setDefault")),
                confirming === cardName
                  ? h("span", { className: "__sl_row" },
                    h("button", { type: "button", className: "__sl_btn __sl_btnDanger", onClick: function () { onDeleteCard(cardName); }, disabled: busy }, t("confirmDeleteShort")),
                    h("button", { type: "button", className: "__sl_btn", onClick: function () { setConfirming(""); clearFeedback("cards"); }, disabled: busy }, t("cancel")))
                  : h("button", { type: "button", className: "__sl_btn __sl_btnDanger", onClick: function () { onDeleteCard(cardName); }, disabled: busy }, t("deleteCard"))
              );
            })),
          h("label", { className: "__sl_field" },
            h("span", { className: "__sl_label" }, t("cardName")),
            h("span", { className: "__sl_hint" }, t("cardNameHint")),
            h("input", {
              className: "__sl_input",
              type: "text",
              value: cardDraft.name,
              placeholder: t("cardNamePlaceholder"),
              onChange: function (e) {
                var next = e.target.value;
                setCardDraft(function (previous) { return Object.assign({}, previous, { name: next }); });
                clearFeedback("cards");
              },
            })
          ),
          h("label", { className: "__sl_field" },
            h("span", { className: "__sl_label" }, t("cardContent")),
            h("span", { className: "__sl_hint" }, t("cardContentHint")),
            h("textarea", {
              className: "__sl_input __sl_textarea",
              value: cardDraft.content,
              onChange: function (e) {
                var next = e.target.value;
                setCardDraft(function (previous) { return Object.assign({}, previous, { content: next }); });
                clearFeedback("cards");
              },
            })
          ),
          h("div", { className: "__sl_actions" },
            h("button", { type: "button", className: "__sl_btn __sl_btnPrimary", onClick: onSaveCard, disabled: busy }, editing ? t("saveCard") : t("newCard")),
            editing ? h("button", { type: "button", className: "__sl_btn", onClick: onCancelEdit, disabled: busy }, t("cancel")) : null,
            cardsFeedback.notice ? h("span", { className: "__sl_status" }, messageText(t, cardsFeedback.notice)) : null,
            busyGroup === "cards" ? h("span", { className: "__sl_status" }, t("saving")) : null,
            cardsFeedback.error ? h("span", { className: "__sl_error", role: "alert" }, messageText(t, cardsFeedback.error)) : null
          )
        ),

        // ── per-workspace choice ──────────────────────────────────────────
        h("fieldset", { className: "__sl_group", disabled: busyGroup === "workspace", style: { border: 0, margin: 0, padding: 0, minWidth: 0 } },
          h("p", { className: "__sl_label", style: { margin: 0 } }, t("workspaceTitle")),
          h("p", { className: "__sl_hint", style: { margin: 0 } }, t("workspaceHint")),
          wsFailed
            ? h("p", { className: "__sl_status" }, t("workspaceUnavailable"))
            : wsOptions === null
              ? h("p", { className: "__sl_status" }, t("loading"))
              : wsList.length === 0 && staleKeys.length === 0
                ? h("p", { className: "__sl_status" }, t("workspaceEmpty"))
                : null,
          h("div", { className: "__sl_cardList" },
            wsList.map(function (entry) { return renderWsRow(entry.path, entry.title, false); }),
            staleKeys.map(function (path) { return renderWsRow(path, "", true); })
          ),
          h("div", { className: "__sl_actions" },
            h("button", { type: "button", className: "__sl_btn", onClick: loadWorkspaces, disabled: busy }, t("refresh")),
            wsFeedback.notice ? h("span", { className: "__sl_status" }, messageText(t, wsFeedback.notice)) : null,
            busyGroup === "workspace" ? h("span", { className: "__sl_status" }, t("saving")) : null,
            wsFeedback.error ? h("span", { className: "__sl_error", role: "alert" }, messageText(t, wsFeedback.error)) : null
          )
        ),

        // ── options ──────────────────────────────────────────────────────
        h("fieldset", { className: "__sl_group", disabled: busyGroup === "flags", style: { border: 0, margin: 0, padding: 0, minWidth: 0 } },
          h("p", { className: "__sl_label", style: { margin: 0 } }, t("optionsTitle")),
          renderSwitchRow("showPersonaSwitcher", "fieldShowPersonaSwitcher", "showPersonaSwitcherHint", value.showPersonaSwitcher !== false),
          renderSwitchRow("skipSubagents", "fieldSkipSubagents", "skipSubagentsHint", value.skipSubagents !== false),
          h("div", { className: "__sl_actions" },
            flagsFeedback.notice ? h("span", { className: "__sl_status" }, messageText(t, flagsFeedback.notice)) : null,
            busyGroup === "flags" ? h("span", { className: "__sl_status" }, t("saving")) : null,
            flagsFeedback.error ? h("span", { className: "__sl_error", role: "alert" }, messageText(t, flagsFeedback.error)) : null
          )
        )
      );
    }

    // ── plugin ──────────────────────────────────────────────────────────────

    function apply(ctx) {
      var t = ctx.locale.bind(NS);
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, "dsh-soul: dictionaries");
      // ONE scope for the namespace, shared by the settings card and both
      // switcher mounts. Two binds would each keep their own revision
      // bookkeeping over one host document.
      var scope = ctx.configForms.get(CONFIG_NS);
      ctx.slots.inject("plugins.bundle.config", function () {
        return ctx.slots.register({
          name: "plugins.bundle.config",
          key: BUNDLE_KEY,
          locale: NS,
        }, function (props) {
          return h(SoulSection, Object.assign({}, props, { scope: scope, t: t, locale: ctx.locale }));
        });
      });
      ctx.slots.inject("conversation.session.header.actions", function () {
        return ctx.slots.register({
          name: "conversation.session.header.actions",
          id: "soul-persona",
          order: 40,
        }, function (props) {
          return h(PersonaSwitcher, Object.assign({}, props, { scope: scope, t: t, locale: ctx.locale }));
        });
      });
      // The new-session page has no header to switch from, so it gets its own
      // hero slot. Registered only when the switcher is visible at boot; the
      // component also checks the live value, so toggling it hides the switcher
      // on already-open pages without a re-registration.
      var showHeroSwitcher = true;
      try {
        var bootSnapshot = scope.getSnapshot();
        var bootValue = bootSnapshot && typeof bootSnapshot === "object" ? bootSnapshot.value : undefined;
        if (bootValue && bootValue.showPersonaSwitcher === false) showHeroSwitcher = false;
      } catch { /* scope not ready: default visible, the component check still applies */ }
      if (showHeroSwitcher) {
        ctx.slots.inject("conversation.hero.options", function () {
          return ctx.slots.register({
            name: "conversation.hero.options",
            id: "soul-persona-hero",
            order: 40,
          }, function (props) {
            return h(PersonaSwitcher, Object.assign({}, props, {
              scope: scope,
              t: t,
              locale: ctx.locale,
              hero: true,
              holdComposer: function (sessionId, reason) { return holdComposer(props.blocks, sessionId, reason); },
            }));
          });
        });
      }
    }

    module.exports = exports;
    exports.apply = apply;
    exports.inject = inject;    /**
     * Test seam only. The settings write path is the one place where a wrong
     * answer corrupts the user's cards, and these helpers are inside a
     * ModuleLoader closure with no other way to reach them. Nothing in the host
     * reads them.
     */
    exports.__test = {
      settingsOpsApplied: settingsOpsApplied,
      commitSettingsOps: commitSettingsOps,
      postJson: postJson,
      holdComposer: holdComposer,
      cardPreview: cardPreview,
      reservedName: reservedName,
      usableCardNames: usableCardNames,
      dictionaries: { zh: zh, en: en },
      css: CSS,
    };
    return module.exports;
  },
});
