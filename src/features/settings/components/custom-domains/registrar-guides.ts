// Registrar-specific DNS guides for the custom-domain setup wizard.
//
// Each guide is an ordered list of plain-English steps with two placeholders the
// wizard substitutes at render time:
//   {name}  → the CNAME host/name (the subdomain prefix, e.g. "join")
//   {value} → the CNAME target (e.g. "cname.vercel-dns.com")
//
// Bluehost is intentionally first + the default selection — it's what we use and
// can support agents on directly.

export interface RegistrarGuide {
  id: string;
  name: string;
  /** Ordered steps; may contain {name} and {value} placeholders. */
  steps: string[];
  /** Optional callout shown prominently (warnings / gotchas). */
  warning?: string;
}

export const REGISTRAR_GUIDES: RegistrarGuide[] = [
  {
    id: "bluehost",
    name: "Bluehost",
    steps: [
      "Log in to Bluehost and open Domains in the left menu.",
      "Find your domain and click Settings (or Manage).",
      "Open the DNS tab, then the DNS Records section.",
      "Click Add Record and choose type CNAME.",
      'Set "Host Record" (Name) to: {name}',
      'Set "Points to" (Value) to: {value}',
      "Leave TTL at the default (or 4 hours / 14400).",
      "Click Add / Save. That's it — we detect it automatically (usually 5–15 min).",
    ],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    warning:
      'Set Proxy status to "DNS only" (grey cloud, NOT orange). An orange-cloud proxied record breaks domain verification.',
    steps: [
      "Select your domain, then go to DNS → Records.",
      "Click Add record and choose type CNAME.",
      "Name: {name}",
      "Target: {value}",
      'Proxy status: click the cloud so it is grey ("DNS only").',
      "Click Save.",
    ],
  },
  {
    id: "namecheap",
    name: "Namecheap",
    steps: [
      "Go to Domain List and click Manage next to your domain.",
      "Open the Advanced DNS tab.",
      "Click Add New Record → CNAME Record.",
      "Host: {name}",
      "Target: {value}",
      "TTL: Automatic. Click the green checkmark to save.",
    ],
  },
  {
    id: "godaddy",
    name: "GoDaddy",
    steps: [
      "Go to My Products, find your domain, and click DNS (Manage DNS).",
      "Click Add and choose type CNAME.",
      "Name: {name}",
      "Value: {value}",
      "TTL: 1 hour. Click Save.",
    ],
  },
  {
    id: "squarespace",
    name: "Squarespace / Google Domains",
    steps: [
      "Open your domain and go to DNS settings.",
      "Add a custom record of type CNAME.",
      "Host: {name}",
      "Data / Value: {value}",
      "Save.",
    ],
  },
  {
    id: "wix",
    name: "Wix",
    steps: [
      "Go to Domains, select your domain, and open DNS Records (Advanced).",
      "Add a CNAME record.",
      "Host name: {name}",
      "Value: {value}",
      "Save.",
    ],
  },
  {
    id: "other",
    name: "Other / not sure",
    steps: [
      "Log in to wherever your domain's DNS is managed (your registrar or host).",
      "Add a new DNS record of type CNAME.",
      "Name / Host: {name}",
      "Value / Points to: {value}",
      "Save. We detect it automatically once it propagates (usually 5–15 min).",
      "Stuck? Ask Nick — he can walk you through it.",
    ],
  },
];

/** Substitute {name}/{value} placeholders in a guide step. */
export function fillGuideStep(
  step: string,
  name: string,
  value: string,
): string {
  return step.replace(/\{name\}/g, name).replace(/\{value\}/g, value);
}
