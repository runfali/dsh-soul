# dsh-soul

[English | [简体中文](./README.zh-CN.md)]

**dsh-soul gives DeepSeek Harness a soul.**

Out of the box the harness is a capable generalist whose identity is authored by the deployment: one persona per install, decided when the composition is written. This plugin turns that identity into data you own — Markdown persona cards stored in settings, resolved per session and per workspace, injected into the system prompt as a single section that is re-resolved on every turn. The model can read its own card; it can never rewrite it.

A standalone plugin: it reads and writes exactly one settings document (`soul`) and nothing else — no other plugin's namespace, no file on disk, no shared state.

## Why a soul

- **One install, several selves.** The same harness should be a terse reviewer in one workspace and a patient teacher in another. A card makes that a setting instead of a fork, a preset, or a second install.
- **The soul is text, so it is inspectable.** Everything the assistant believes about itself is Markdown you can read, diff, and keep in version control — not an opaque system string baked into the app.
- **It survives the turn.** The card is re-read at prompt-assembly time rather than captured when the session starts, so editing it changes the very next turn: no restart, no new session.
- **It stays yours.** Persona text reaches the prompt only because you typed it. There is no tool, route, or hook that lets a model write a card.

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
| **Settings card** | Settings → Plugins → `dsh-soul` → the component row `dsh-soul ›` | Card list, editor (create / rename / edit / delete / set default), per-workspace choices, and two switches |
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
| 3 | Default | `active` | The card marked as default |
| — | — | — | Nothing set: the section renders empty and the host omits it |

A stored choice that names a card which no longer exists (or a card that is blank) reads as *no choice* and falls through to the next layer, rather than silently suppressing the default. In the workspace table such a row is kept visible and marked so it can be cleared.

`skipSubagents` (on by default) suppresses the persona for delegated child sessions: they inherit the parent's prompt anyway, so repeating the card costs tokens and blurs scope. Resolution itself is never gated — `persona_read` and the switcher still agree with what the session *would* inject.

## Requirements

- dsh `>=0.2.0-rc.2 <0.3.0-0`, with the `0.2.1-rc.*` releases listed individually in `dsh.compatibility`
- Node `>=20.18`
- React 18 as a peer (supplied by the harness)
- Profiles `web` and `desktop`

## Install

From a checkout — a `link:` install symlinks the directory, so the host imports this source directly:

```sh
cd <checkout>
npm ci                                          # the dev dependencies are needed for tests, not at runtime
dsh plugin --profile desktop add link:<absolute path to checkout>
```

Use `--profile web` for the web profile. Restart DSH, then open **Settings → Plugins → dsh-soul**; the form lives on the component row, so open `dsh-soul ›` from the bundle's component list.

Once the package is published to a registry, the same command without `link:` installs it by name:

```sh
dsh plugin --profile desktop add dsh-soul
```

The bundle patch (`cordis.patch.yml`) declares the loader entry `id: dsh-soul` — the same string as the package and the settings namespace, because the plugin page prints the row id next to the module name and two different names there read as two different plugins. That id **is** the settings namespace: renaming it orphans every saved card. Before 0.2 the row was `soul`; the card still reads that namespace as a fallback, so an unrenamed profile keeps working.

## Quick start

1. Open the card (Plugins → `dsh-soul` → `dsh-soul ›`), type a name and the card's Markdown, save it.
2. Set it as the default card, or assign it to a workspace. The chat header switches it per session.
3. Ask something. What changed is the system prompt, not the tools — the card is in force from the next turn.
4. To silence the persona for one session, choose off in that session's header; the workspace and default layers are skipped for it alone.

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

## Writing a card

A card is prompt text, and the useful ones are short. What earns its place:

- **Who it is**: a name, a role, the register it speaks in.
- **How it addresses you**: the form of address, the language, whether it explains or asserts.
- **What it refuses**: the disclaimers, hedging, or habits that break the illusion.
- **What it is for**: the job this identity serves, in one line.

What does not: tool usage rules, safety policy, or anything that is really an instruction for one task. Those belong in the turn that needs them; a persona is the constant, not the task.

## Under the hood

The settings card is registered on `plugins.row.config` under the key `dsh-soul#dsh-soul` (`<package>#<row id>`), plus the legacy `dsh-soul#soul`, which is what the plugin manager checks before it lets a component row open a page. The plugin page therefore lists the row and nothing else; the row also answers the summary view with one line (card count and default). The card itself is a hand-written ModuleLoader bundle styled only from host theme tokens (`--dsw-alias-*`, `--dsw-radius-*`, `--dsw-focus-ring-*`), with all classes prefixed `__sl_` so two plugins cannot restyle each other, and every control writes immediately — one batch per action, no page-level save bar.

One same-origin `POST` route backs the card: `POST /api/soul/workspaces` lists the host's workspaces so a mapping can be offered by title. Exact `/api` routes bypass the harness fence, so the route does its own checks — non-JSON is refused with `415`, and a cross-site `Origin` (or `Origin: null`, or `Sec-Fetch-Site: cross-site`) with `403`. Same-origin is decided by comparing the `Origin` host with the request's `Host` header, **not** with `request.url`: the host rewrites the URL onto a synthetic `http://dsh.internal` base before the route sees it, so a URL-based comparison would refuse every real call. A request with no `Origin` at all is allowed — that is a local script, not a browser. The response carries `{version: 1, …}`; a version mismatch is treated as unavailable rather than guessed at.

## Development

```bash
npm install --cache ./.npm-cache    # a local cache keeps the sandbox out of %LOCALAPPDATA%
npm test
```

`npm test` runs **114 tests** in one process (`--experimental-test-isolation=none`, because a restricted sandbox may block the runner's child processes):

- `persona.test.mjs` — resolution order, the `none` sentinel, stale and blank choices, path normalization, the subagent gate
- `routes.test.mjs` — request guards (415 / 403 / same-origin), build failures, version envelope
- `host-plugin.test.mjs` — the plugin surface against a fake host: section registration, tool schema, the workspace route, duplicate-name behaviour
- `host-contract.test.mjs` — the same claims against the **real** `@deepseek-ai/cordis` + `dsh-system-prompt` + `dsh-tools`, including that a disposer really unregisters
- `client-bundle.test.mjs` — bundle hygiene: loader id, requires, injected services, slot metas, the namespace fallback, zh/en key parity, no dead translation keys
- `client-settings.test.mjs` — the card driven through the real components: create, rename (one batch), two-click delete, single-key writes, refusals, read-only, and the row summary line
- `client-switcher.test.mjs` — the session switcher: three states, single-key writes, hidden state, composer hold

The client tests load the shipped `client.js` into a mini hooks runtime rather than a copy of the code, so the assertions run against the file that ships.

## License

MIT
