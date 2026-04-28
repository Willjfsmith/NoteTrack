/**
 * Composer parser — turns a single raw line into a structured entry payload.
 *
 * Examples:
 *   /risk HV switchgear lead time slipping #SWG-401 @lr p:4 i:4
 *   /todo chase Diane on civils #CIV-013 due:thu
 *   /done $1.2k for the comms cards #SWG-401
 *   plain note with #CV-203 and @sk
 *
 * The parser is deliberately small and synchronous so it can run on the server
 * action boundary AND inside the live composer for chip previews. It does not
 * validate authorisation or look anything up in the database — that happens
 * in the server action that consumes its output.
 */

export type EntryType = "note" | "action" | "decision" | "risk" | "call";

export type ParsedEntry = {
  /** Final classified entry type. `note` is the fallback. */
  type: EntryType;
  /** Body with the slash command stripped. Refs/mentions are kept inline. */
  body: string;
  /** Distinct refs gathered from the input. */
  refs: {
    items: string[];
    people: string[];
  };
  /** Optional money attached via `$1.2k`, `$2m`, `$500`, etc. — value in pence/cents. */
  money?: number;
  /** Optional ISO-date string `YYYY-MM-DD` for `due:` keyword. */
  due?: string;
  /** Risk-specific 1–5 probability via `p:N`. */
  probability?: number;
  /** Risk-specific 1–5 impact via `i:N`. */
  impact?: number;
  /** Whether the input started with a `/done` slash, which marks an action complete. */
  doneShortcut: boolean;
};

const SLASH_COMMANDS: Record<string, EntryType | "todo" | "done"> = {
  note: "note",
  todo: "action",
  action: "action",
  done: "done",
  decision: "decision",
  risk: "risk",
  call: "call",
};

const ITEM_RE = /(?<![A-Za-z0-9_])#([A-Za-z][\w-]{0,63})/g;
const PERSON_RE = /(?<![A-Za-z0-9_])@([a-z0-9][a-z0-9_]{0,31})/gi;
// `$1.2k`, `$500`, `$2m`, `$1,000`, optionally trailing currency suffix.
const MONEY_RE = /\$(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?\s*([kKmM]?)\b/;
const DUE_RE = /\bdue:([+A-Za-z0-9-]+)/i;
const P_RE = /\bp:([1-5])\b/i;
const I_RE = /\bi:([1-5])\b/i;

const WEEKDAYS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Resolve `due:` keyword to an ISO date relative to `now`. */
export function resolveDue(keyword: string, now: Date = new Date()): string | undefined {
  const k = keyword.toLowerCase();

  if (k === "today") return toISODate(startOfDay(now));
  if (k === "tomorrow" || k === "tom") {
    const t = startOfDay(now);
    t.setDate(t.getDate() + 1);
    return toISODate(t);
  }
  if (k === "eow" || k === "endofweek") {
    const t = startOfDay(now);
    const delta = (5 - t.getDay() + 7) % 7 || 7;
    t.setDate(t.getDate() + delta);
    return toISODate(t);
  }
  if (k === "nextweek" || k === "nw") {
    const t = startOfDay(now);
    const delta = (1 - t.getDay() + 7) % 7 || 7;
    t.setDate(t.getDate() + delta);
    return toISODate(t);
  }

  if (k in WEEKDAYS) {
    const target = WEEKDAYS[k];
    const t = startOfDay(now);
    const delta = (target - t.getDay() + 7) % 7 || 7;
    t.setDate(t.getDate() + delta);
    return toISODate(t);
  }

  // ISO `YYYY-MM-DD`.
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return k;

  // Relative `+3d`, `+2w`.
  const rel = /^\+(\d+)([dw])$/.exec(k);
  if (rel) {
    const t = startOfDay(now);
    const n = Number(rel[1]);
    if (rel[2] === "d") t.setDate(t.getDate() + n);
    else t.setDate(t.getDate() + n * 7);
    return toISODate(t);
  }

  return undefined;
}

/** Convert `$1.2k`/`$2m`/`$500` into a positive number of pence (×100). */
export function resolveMoney(intPart: string, fracPart: string | undefined, suffix: string):
  | number
  | undefined {
  const cleanInt = intPart.replace(/,/g, "");
  if (!/^\d+$/.test(cleanInt)) return undefined;
  let unitMultiplier = 1;
  if (suffix === "k" || suffix === "K") unitMultiplier = 1_000;
  else if (suffix === "m" || suffix === "M") unitMultiplier = 1_000_000;

  const wholeNum = Number(cleanInt);
  const fracNum = fracPart ? Number("0." + fracPart) : 0;
  if (Number.isNaN(wholeNum) || Number.isNaN(fracNum)) return undefined;
  // Round to whole pence.
  return Math.round((wholeNum + fracNum) * unitMultiplier * 100);
}

export function parseComposer(input: string, now: Date = new Date()): ParsedEntry {
  let body = input ?? "";
  let type: EntryType = "note";
  let doneShortcut = false;

  // Strip leading slash command.
  const slashMatch = /^\s*\/([a-z]+)\b\s*/i.exec(body);
  if (slashMatch) {
    const cmd = slashMatch[1].toLowerCase();
    const mapped = SLASH_COMMANDS[cmd];
    if (mapped) {
      if (mapped === "todo") type = "action";
      else if (mapped === "done") {
        type = "action";
        doneShortcut = true;
      } else type = mapped;
      body = body.slice(slashMatch[0].length);
    }
  }

  // Money — strip & capture (only first occurrence).
  let money: number | undefined;
  const moneyMatch = MONEY_RE.exec(body);
  if (moneyMatch) {
    const resolved = resolveMoney(moneyMatch[1], moneyMatch[2], moneyMatch[3]);
    if (resolved !== undefined) {
      money = resolved;
      body = (body.slice(0, moneyMatch.index) + body.slice(moneyMatch.index + moneyMatch[0].length))
        .replace(/\s{2,}/g, " ")
        .trim();
    }
  }

  // due:
  let due: string | undefined;
  const dueMatch = DUE_RE.exec(body);
  if (dueMatch) {
    const resolved = resolveDue(dueMatch[1], now);
    if (resolved) {
      due = resolved;
      body = (body.slice(0, dueMatch.index) + body.slice(dueMatch.index + dueMatch[0].length))
        .replace(/\s{2,}/g, " ")
        .trim();
    }
  }

  // p: / i: (only meaningful for risks but harmless on others; we still strip).
  let probability: number | undefined;
  const pMatch = P_RE.exec(body);
  if (pMatch) {
    probability = Number(pMatch[1]);
    body = (body.slice(0, pMatch.index) + body.slice(pMatch.index + pMatch[0].length))
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  let impact: number | undefined;
  const iMatch = I_RE.exec(body);
  if (iMatch) {
    impact = Number(iMatch[1]);
    body = (body.slice(0, iMatch.index) + body.slice(iMatch.index + iMatch[0].length))
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  // Refs are NOT stripped — they remain in body so the diary renderer can chip them.
  const items = uniq(Array.from(body.matchAll(ITEM_RE), (m) => m[1]));
  const people = uniq(Array.from(body.matchAll(PERSON_RE), (m) => m[1].toLowerCase()));

  body = body.trim();

  return {
    type,
    body,
    refs: { items, people },
    money,
    due,
    probability,
    impact,
    doneShortcut,
  };
}

function uniq<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of arr) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}
