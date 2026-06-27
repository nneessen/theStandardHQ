// src/features/social-cards/templateCopy.ts
// Shared "editable copy" plumbing for the template cards (recruiting + welcome). Every
// visible sentence on those cards is an override-able field: the card resolves
// copy[field] ?? a built-in default, so the owner controls the wording while a blank field
// falls back to the default. Lists (the strikethrough list, chips, vs-columns) edit as
// one-item-per-line text. Pure + deterministic so preview == PNG export.

/** One editable text slot on a template, with its built-in default. */
export interface CopyField {
  /** Stable id; overrides are stored under `${variant}.${key}`. */
  key: string;
  /** Plain-English label shown in the editor. */
  label: string;
  /** Built-in default text. For list fields this is the items joined by "\n". */
  default: string;
  /** Edit as a multi-line list (one item per line) instead of a single value. */
  list?: boolean;
  /** Render a multi-line textarea (for long sentences). */
  multiline?: boolean;
}

export type CopyMap = Record<string, string>;

/** Resolve a single text slot: the override if non-blank, else the default. */
export function copyText(
  copy: CopyMap | undefined,
  key: string,
  dflt: string,
): string {
  const v = copy?.[key];
  return v != null && v.trim() !== "" ? v : dflt;
}

/** Resolve a list slot: the override's non-blank lines if any, else the defaults. */
export function copyList(
  copy: CopyMap | undefined,
  key: string,
  dflt: string[],
): string[] {
  const v = copy?.[key];
  if (v == null || v.trim() === "") return dflt;
  const items = v
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : dflt;
}

/** Replace {token} placeholders (e.g. {agency}) in a resolved string. */
export function applyTokens(s: string, tokens: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => tokens[k] ?? `{${k}}`);
}

/** The per-variant subset of a flat `${variant}.${field}` override map, keyed by field. */
export function copyForVariant(
  all: CopyMap | undefined,
  variant: string,
): CopyMap {
  if (!all) return {};
  const prefix = `${variant}.`;
  const out: CopyMap = {};
  for (const k of Object.keys(all)) {
    if (k.startsWith(prefix)) out[k.slice(prefix.length)] = all[k];
  }
  return out;
}
