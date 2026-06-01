/*
 * Inline SVG icon set for the HQ landing page.
 * Ported from the reference's ICONS path-data map + svg() helper. Each entry is
 * raw <path d="…"> data; <Icon name> renders a 24×24 stroked glyph. Keys match
 * the string identifiers used throughout the hq/data/* content files.
 */

export type IconName =
  | "crm"
  | "ai"
  | "phone"
  | "card"
  | "db"
  | "chat"
  | "mail"
  | "bolt"
  | "doc"
  | "cloud"
  | "cal"
  | "scan";

const PATHS: Record<IconName, string> = {
  crm: "M3 7h18v11H3zM3 11h18",
  ai: "M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z",
  phone: "M4 5c0 9 6 15 15 15l2-4-5-2-2 2c-3-1.5-5-3.5-6-6l2-2-2-5z",
  card: "M3 7h18v11H3zM3 11h18",
  db: "M5 6c0-1.7 3-3 7-3s7 1.3 7 3-3 3-7 3-7-1.3-7-3zM5 6v12c0 1.7 3 3 7 3s7-1.3 7-3V6",
  chat: "M5 5h14v10H9l-4 4z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  doc: "M7 3h7l4 4v14H7zM14 3v4h4",
  cloud: "M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1A3.5 3.5 0 0 1 17 18z",
  cal: "M4 6h16v14H4zM4 9h16M8 4v4M16 4v4",
  scan: "M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M7 12h10",
};

/** Split combined path data on "M" into discrete <path> elements (matches the reference svg() helper). */
function toPaths(d: string) {
  return d
    .split("M")
    .filter(Boolean)
    .map((seg, i) => <path key={i} d={`M${seg}`} />);
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {toPaths(PATHS[name])}
    </svg>
  );
}
