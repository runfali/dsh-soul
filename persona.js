/**
 * Pure persona resolution for dsh-soul.
 *
 * No Cordis, no settings service, no filesystem: this module takes the config
 * value and an agent and answers "which card does this session get". The plugin
 * wires it to the live config; the tests import it directly, so the resolution
 * order is verified without booting a host.
 *
 * ORDER (first usable answer wins)
 *   1. per-session choice   `sessions[sessionId]`
 *   2. per-workspace choice `workspaces[<session cwd>]`
 *   3. default card         `active`
 *   4. none
 *
 * A choice of CHOICE_NONE ("none") is a REAL answer — it stops the search and
 * means "this session/workspace gets no persona", not "fall through". A choice
 * that names a card which no longer exists (or whose content is blank) is not
 * an answer: it is a stale reference, so it falls through instead of silently
 * disabling the persona.
 */

/** The stored value that means "explicitly no persona". */
export const CHOICE_NONE = "none";

/** A non-array object, or an empty one. Config values can be anything a hand-edited document holds. */
export function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * Card NAMES, sorted, for checklists and count displays.
 *
 * A card counts when its stored content is a non-blank string: an empty card
 * would inject nothing, so offering it in a switcher would be a choice that
 * changes nothing.
 */
export function cardNames(config) {
  const cards = plainObject(config?.cards);
  return Object.keys(cards)
    .filter((cardName) => typeof cards[cardName] === "string" && cards[cardName].trim() !== "")
    .sort();
}

/** Whether `name` addresses a card with injectable content. */
export function hasCard(cards, name) {
  const map = plainObject(cards);
  if (typeof name !== "string" || name === "") return false;
  if (!Object.hasOwn(map, name)) return false;
  return typeof map[name] === "string" && map[name].trim() !== "";
}

/**
 * One path, comparable across a workspace registry entry and a session cwd.
 *
 * The registry publishes absolute paths; the session header publishes the cwd
 * it was opened with. On Windows those two spellings differ in case and
 * separator (`D:\DSH` vs `D:/DSH/`), so a raw string compare misses a mapping
 * the user can see in the settings page. Lowercasing merges two genuinely
 * distinct paths only on a case-sensitive filesystem, which is exactly where
 * the exact-key pass below answers first.
 */
export function normalizePath(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const slashed = raw.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  const trimmed = slashed.length > 1 ? slashed.replace(/\/+$/, "") : slashed;
  return trimmed.toLowerCase();
}

/**
 * The workspace mapping that applies to `cwd`, or null.
 *
 * Exact key first (the registry's own spelling), then a normalized scan, so a
 * mapping survives a drive-letter case change or a trailing separator.
 */
export function workspaceChoice(workspaces, cwd) {
  const map = plainObject(workspaces);
  const dir = typeof cwd === "string" ? cwd.trim() : "";
  if (!dir) return null;
  if (Object.hasOwn(map, dir) && typeof map[dir] === "string" && map[dir].trim() !== "") return map[dir].trim();
  const wanted = normalizePath(dir);
  if (!wanted) return null;
  for (const key of Object.keys(map)) {
    if (normalizePath(key) !== wanted) continue;
    const value = map[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

/** Session id / workspace directory of an agent, read defensively (this is host state). */
export function agentTarget(agent) {
  let sessionId = "";
  let cwd = "";
  try {
    const id = agent?.session?.id;
    if (typeof id === "string") sessionId = id;
  } catch {
    sessionId = "";
  }
  try {
    const dir = agent?.session?.header?.cwd;
    if (typeof dir === "string") cwd = dir;
  } catch {
    cwd = "";
  }
  return { sessionId, cwd };
}

/** Whether this agent is a delegated child session. */
export function isSubagent(agent) {
  try {
    return agent?.session?.header?.origin === "subagent";
  } catch {
    return false;
  }
}

/**
 * Whether the persona is suppressed for this agent.
 *
 * Delegated children inherit the parent's prompt in practice, so a persona
 * repeated into every subagent costs tokens and confuses scope. On by default;
 * `skipSubagents: false` is the escape hatch.
 */
export function skipsSubagent(config, agent) {
  return config?.skipSubagents !== false && isSubagent(agent);
}

/**
 * The card that applies to a target, as `{name, text, source}`.
 *
 * `source` is "session" | "workspace" | "default" | null and exists so the UI
 * and the tests can say WHY a card won without re-deriving the order.
 */
export function resolveCard(config, target = {}) {
  const cards = plainObject(config?.cards);
  const sessions = plainObject(config?.sessions);
  const sessionsId = typeof target.sessionId === "string" ? target.sessionId : "";
  const usable = (name) => hasCard(cards, name);

  if (sessionsId && Object.hasOwn(sessions, sessionsId)) {
    const choice = sessions[sessionsId];
    if (choice === CHOICE_NONE) return { name: null, text: null, source: "session" };
    if (usable(choice)) return { name: choice, text: cards[choice], source: "session" };
  }

  const mapped = workspaceChoice(config?.workspaces, target.cwd);
  if (mapped === CHOICE_NONE) return { name: null, text: null, source: "workspace" };
  if (mapped && usable(mapped)) return { name: mapped, text: cards[mapped], source: "workspace" };

  const active = config?.active;
  if (usable(active)) return { name: active, text: cards[active], source: "default" };

  return { name: null, text: null, source: null };
}

/**
 * The system-prompt text this agent's persona contributes.
 *
 * "" is a deliberate value, not a failure: the section renders empty and the
 * host leaves it out of the prompt. Resolution itself is NEVER gated by
 * `skipSubagents` — only the rendered text is — so the read-only tool and the
 * switcher still agree with what the session would inject.
 */
export function personaTextFor(config, agent) {
  if (skipsSubagent(config, agent)) return "";
  const card = resolveCard(config, agentTarget(agent));
  return typeof card.text === "string" ? card.text : "";
}
