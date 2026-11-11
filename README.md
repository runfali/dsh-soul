# dsh-soul

[English | [简体中文](./README.zh-CN.md)]

Persona cards for DeepSeek Harness. You write Markdown cards in the settings page; the card that applies to a session is resolved from those settings and injected into the system prompt as one section. The model can read the card, never write it.

This is the persona half of the `dsh-soul-md` plugin extracted into its own plugin. Cards live in their own settings namespace (`soul`), so both plugins can be installed side by side while you migrate — and the old one is left completely untouched.

> [!IMPORTANT]
> **Design commitments, in the order they constrain the code**
>
> 1. **Settings, not files.** Cards are ordinary settings values in the `soul` namespace. They hot-reload, they are visible in the settings UI, and they inherit the host's revision checks. Nothing is written to a data directory, and no file format is invented.
> 2. **One section, one owner.** The prompt section is `dsh-soul:persona`. The old plugin registers `soul:persona`, and the host throws on a duplicate section name — a shared name would take the whole profile down, so the names are deliberately different.
> 3. **Every write is the smallest one that does the job.** A session choice writes one key (`sessions.<id>`), a workspace choice writes one key (`workspaces.<path>`). Writing the whole map would copy lower-layer entries into the user layer and pin choices the user never made.
> 4. **A write is not saved until the host agrees.** After mutating, the result is verified against the fresh snapshot; a resolved-but-refused write is reported as a failure, and the draft stays in the form.
> 5. **Read-only for the model.** `persona_read` exists so an agent can quote its own persona; there is no write tool, no route that accepts card text, and no prompt-injection surface beyond what the user typed into the card.

## What you get

| Surface | Where | What it does |
| --- | --- | --- |
| **Settings card** | Settings → Plugins → *Persona cards* | Card list, editor (create / rename / edit / delete / set default), per-workspace choices, two switches, and a one-click import from the old namespace |
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

## Migrating from `dsh-soul-md`

Open the settings card and press **读取 soul-md 的卡片 / Read soul-md cards**. The scan lists what the old namespace holds and marks the cards that already exist here; then **导入 / Import** copies:

- every card whose name does not exist here yet (an existing card is never overwritten — the old text of a card you have edited here is not what you would want),
- the old default card, but only when this namespace has no default of its own.

The old namespace is only ever read. Nothing is deleted there, the old plugin keeps working, and you can re-run the import as often as you like.

**While both plugins are enabled, the old one keeps injecting its own persona** — different section name, same job — so with cards on both sides the prompt carries two personas at once. Once the copy looks right, clear the old default card (or disable `dsh-soul-md`). This plugin never disables it for you, and never writes to its namespace.

## Compatibility

- dsh `>=0.2.0-rc.2 <0.3.0-0`, with `0.2.1-rc.1` … `0.2.1-rc.5` listed individually in `dsh.compatibility`
- Node `>=20.18`
- Client platform `web`; the package declares `web` and `desktop` profiles
- React 18 as a peer (supplied by the harness)

The bundle patch (`cordis.patch.yml`) declares the loader entry `id: soul`. That id **is** the settings namespace: renaming it orphans every saved card.

## Internals worth knowing

Two same-origin `POST` endpoints back the settings card. Exact `/api` routes bypass the harness fence, so they do their own checks: a non-JSON request is refused with `415`, and a cross-site `Origin` (or `Origin: null`) with `403`. A same-origin call with no `Origin` header is allowed, which is what the desktop client sends.

| Route | Purpose |
| --- | --- |
| `/api/soul/workspaces` | List the host's workspaces, so the settings card can offer them by title |
| `/api/soul/import` | Read the legacy `soul-md` namespace (cards + default), never write it |

Both answer `{version: 1, …}`; a version mismatch is treated as "unavailable" rather than guessed at.

## Development

```bash
npm install --cache ./.npm-cache    # a local cache keeps the sandbox out of %LOCALAPPDATA%
npm test
```

`npm test` runs 108 tests in one process (`--experimental-test-isolation=none`, because a restricted sandbox may block the runner's child processes):

- `persona.test.mjs` — resolution order, the `none` sentinel, stale and blank choices, path normalization, the subagent gate
- `routes.test.mjs` — request guards (415 / 403 / same-origin), build failures, version envelope
- `host-plugin.test.mjs` — the plugin surface against a fake host: section registration, tool schema, both routes, duplicate-name behaviour
- `host-contract.test.mjs` — the same claims against the **real** `@deepseek-ai/cordis` + `dsh-system-prompt` + `dsh-tools`, including that a disposer really unregisters
- `client-bundle.test.mjs` — bundle hygiene: loader id, requires, injected services, slot metas, zh/en key parity, no dead translation keys
- `client-settings.test.mjs` — the settings card driven through the real components: create, rename (one batch), two-click delete, single-key writes, refusals, read-only, import
- `client-switcher.test.mjs` — the session switcher: three states, single-key writes, hidden state, composer hold

The client tests load the shipped `client.js` into a mini hooks runtime rather than a copy of the code, so the assertions run against the file that ships.

## License

MIT
