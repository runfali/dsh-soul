# dsh-soul

[English | [简体中文](./README.zh-CN.md)]

Persona cards for DeepSeek Harness. You write Markdown cards in the settings page; the card that applies to a session is resolved from those settings and injected into the system prompt as one section. The model can read the card, never write it.

A standalone plugin: it reads and writes exactly one settings document (`soul`) and nothing else — no other plugin's namespace, no file on disk, no shared state.

> [!IMPORTANT]
> **Design commitments, in the order they constrain the code**
>
> 1. **Settings, not files.** Cards are ordinary settings values in the `soul` namespace. They hot-reload, they are visible in the settings UI, and they inherit the host's revision checks. Nothing is written to a data directory, and no file format is invented.
> 2. **One section, one owner.** The prompt section is `dsh-soul:persona` — scoped by package, not by feature. The host throws on a duplicate section name and that throw lands inside `apply()`, so a generic name like `soul:persona` is the one most likely to collide and take the whole plugin down.
> 3. **Every write is the smallest one that does the job.** A session choice writes one key (`sessions.<id>`), a workspace choice writes one key (`workspaces.<path>`). Writing the whole map would copy lower-layer entries into the user layer and pin choices the user never made.
> 4. **A write is not saved until the host agrees.** After mutating, the result is verified against the fresh snapshot; a resolved-but-refused write is reported as a failure, and the draft stays in the form.
> 5. **Read-only for the model.** `persona_read` exists so an agent can quote its own persona; there is no write tool, no route that accepts card text, and no prompt-injection surface beyond what the user typed into the card.

## What you get

| Surface | Where | What it does |
| --- | --- | --- |
| **Settings card** | Settings → Plugins → `dsh-soul` → 包含的组件 → `soul ›` | Card list, editor (create / rename / edit / delete / set default), per-workspace choices, and two switches |
| **Session switcher** | Chat header, one per conversation | Pins a card to *this* session, or turns the persona off for it |
| **New-session switcher** | New-session page options | The same choice before the first message; the composer is held until the choice is stored |
| **`persona_read`** | Agent tool list | Returns the card that applies to the calling session (name, text, and which layer won) |
| **Prompt section** | System prompt, `dsh-soul:persona` | The resolved card's text, re-resolved every turn |

## How a card is chosen

Resolution runs per agent, at prompt-assembly time, in this order:

| # | Layer | Key | Notes |
| --- | --- | --- | --- |
| 1 | Session | `sessions.<sessionId>` | `"none"` turns the persona off **and stops the search** — a session that said off does not fall through to the workspace card |
| 2 | Workspace | `workspaces.<path>` | Exact key first, then a case-insensitive match on the normalized path (Windows paths differ in case between sessions) |
| 3 | Default | `active` | The card marked 默认 / default |
| — | — | — | Nothing set: the section renders empty and the host omits it |

A stored choice that names a card which no longer exists (or a card that is blank) reads as *no choice* and falls through to the next layer, rather than silently suppressing the default. In the workspace table such a row is kept visible and marked so it can be cleared.

`skipSubagents` (on by default) suppresses the persona for delegated child sessions: they inherit the parent's prompt anyway, so repeating the card costs tokens and blurs scope. Resolution itself is never gated — `persona_read` and the switcher still agree with what the session *would* inject.

## Settings

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `cards` | `{ [name]: markdown }` | `{}` | The cards. A blank name or blank body is refused; `__proto__` and `prototype` are refused as names |
| `active` | `string` | `""` | Name of the default card |
| `sessions` | `{ [sessionId]: name \| "none" }` | `{}` | Per-session choice |
| `workspaces` | `{ [path]: name \| "none" }` | `{}` | Per-workspace choice |
| `showPersonaSwitcher` | `boolean` | `true` | Show the switcher in the chat header and on the new-session page |
| `skipSubagents` | `boolean` | `true` | Do not inject the persona into delegated child sessions |

All of it is volatile, so the settings page edits it live — no restart.

## Compatibility

- dsh `>=0.2.0-rc.2 <0.3.0-0`, with `0.2.1-rc.1` … `0.2.1-rc.5` listed individually in `dsh.compatibility`
- Node `>=20.18`
- Client platform `web`; the package declares `web` and `desktop` profiles
- React 18 as a peer (supplied by the harness)

The bundle patch (`cordis.patch.yml`) declares the loader entry `id: soul`. That id **is** the settings namespace: renaming it orphans every saved card.

## Internals worth knowing

One same-origin `POST` endpoint backs the settings card. Exact `/api` routes bypass the harness fence, so they do their own checks: a non-JSON request is refused with `415`, and a cross-site `Origin` (or `Origin: null`, or a `Sec-Fetch-Site` that says cross-site) with `403`. Same-origin is decided by comparing the `Origin` host with the request's `Host` header — **not** with `request.url`, which the host rewrites to a synthetic `http://dsh.internal` base before it reaches the route, so a URL-based comparison would refuse every real call. A call with no `Origin` header at all is allowed, which is what a local script or the desktop client sends.

| Route | Purpose |
| --- | --- |
| `/api/soul/workspaces` | List the host's workspaces, so the settings card can offer them by title |

It answers `{version: 1, …}`; a version mismatch is treated as "unavailable" rather than guessed at.

The settings card is registered on `plugins.row.config` under the key `dsh-soul#soul` (`<package>#<row id>`), so it lives on the component row's own page: the plugin page only lists the row, and clicking it opens the card — the same shape dsh-ops uses. The row also gets a one-line summary (card count and default) for the row description. The card itself is a hand-written ModuleLoader bundle that styles itself from host theme tokens (`--dsw-alias-*`, `--dsw-radius-*`, `--dsw-focus-ring-*`) with no literal colours, so light and dark themes both work without a fallback table. Its classes are all `__sl_*`: sharing names with another plugin would let whichever loads last restyle the other. The switch prefers the host's own `Switch` when `@deepseek-ai/dsh-client-ui-primitives` is requireable and otherwise renders an element-equivalent one, because a hand-written bundle cannot count on that module. Every control writes immediately, in one batch per action — there is no page-level save bar, since a draft editor over a card list would lose the user's intent.

## Development

```bash
npm install --cache ./.npm-cache    # a local cache keeps the sandbox out of %LOCALAPPDATA%
npm test
```

`npm test` runs 110 tests in one process (`--experimental-test-isolation=none`, because a restricted sandbox may block the runner's child processes):

- `persona.test.mjs` — resolution order, the `none` sentinel, stale and blank choices, path normalization, the subagent gate
- `routes.test.mjs` — request guards (415 / 403 / same-origin), build failures, version envelope
- `host-plugin.test.mjs` — the plugin surface against a fake host: section registration, tool schema, the workspace route, duplicate-name behaviour
- `host-contract.test.mjs` — the same claims against the **real** `@deepseek-ai/cordis` + `dsh-system-prompt` + `dsh-tools`, including that a disposer really unregisters
- `client-bundle.test.mjs` — bundle hygiene: loader id, requires, injected services, slot metas, zh/en key parity, no dead translation keys
- `client-settings.test.mjs` — the settings card driven through the real components: create, rename (one batch), two-click delete, single-key writes, refusals, read-only
- `client-switcher.test.mjs` — the session switcher: three states, single-key writes, hidden state, composer hold

The client tests load the shipped `client.js` into a mini hooks runtime rather than a copy of the code, so the assertions run against the file that ships.

## License

MIT
