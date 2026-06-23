// Headless render entry for the leaderboard / report social cards.
// URL params: ?view=daily|weekly|monthly & theme=dark|light & format=post|story
// Renders the REAL card components inside the matching theme wrapper, and flips
// window.__READY__ once webfonts have loaded so the screenshotter can fire.

import { createRoot } from "react-dom/client";
import { domToPng } from "modern-screenshot";
import "@/index.css";
import {
  LeaderboardSocialCard,
  MonthlyReportCard,
  AgentOfWeekCard,
  toLastInitial,
  normalizeCardTheme,
  cardThemeWrapperClass,
  type SocialAgentRow,
  type AowDesign,
  type SocialFormat,
} from "@/features/social-cards";

declare global {
  interface Window {
    __READY__?: boolean;
    // Exposes the REAL in-app download rasterizer (modern-screenshot) on the
    // harness page so verify-rasterizer.mjs can compare its output against the
    // ground-truth native browser screenshot of the same #card.
    __domToPng?: () => Promise<string>;
  }
}

const AGENCY = "THE STANDARD";
const NETWORK = "EPIC LIFE";

// Full names (formatted to last-initial at render). Placeholder data — real cards
// are fed agency-scoped rows from get_leaderboard_data, sorted by AP desc.
const ROSTER = [
  "Marcus Webb",
  "Alyssa Chen",
  "Priya Nair",
  "Jordan Mercer",
  "Devon Brooks",
  "Sofia Alvarez",
  "Tyrone Wallace",
  "Hannah Kim",
  "Liam O'Connor",
  "Grace Okafor",
];

const DAILY_AP = [
  14820, 12400, 11150, 9640, 8200, 7310, 6450, 5720, 4980, 3540,
];
const DAILY_POL = [9, 8, 7, 6, 6, 5, 4, 4, 3, 2];
const WEEKLY_AP = [
  52400, 47900, 43200, 38600, 34100, 29800, 26400, 22900, 19500, 15200,
];
const WEEKLY_POL = [31, 28, 25, 22, 20, 18, 15, 14, 11, 9];

function rows(ap: number[], pol: number[]): SocialAgentRow[] {
  return ROSTER.map((name, i) => ({
    rank: i + 1,
    name: toLastInitial(name),
    agency: AGENCY === "THE STANDARD" ? null : AGENCY,
    ap: ap[i],
    policies: pol[i],
  }));
}

const params = new URLSearchParams(location.search);
const view = params.get("view") || "daily";
// New brand theme (spotlight/editorial/lift); legacy dark/light map through.
const cardTheme = normalizeCardTheme(params.get("theme"));
const fp = params.get("format");
const format: SocialFormat =
  fp === "story" ? "story" : fp === "square" ? "square" : "portrait";
// Self-contained cards carry their own theme; the wrapper class only matters for
// any card still reading the app theme-v2 tokens.
const wrapperClass = cardThemeWrapperClass(cardTheme);

function Card() {
  if (view === "aotw") {
    // Optional Step-3 style overrides via query params, so the harness can render
    // custom-font / custom-background / scaled variants headlessly:
    //   &font="Clash Display", system-ui  &bg=<css>  &titleScale=1.2  &agencyScale=2
    const font = params.get("font");
    const bg = params.get("bg");
    const titleScale = params.get("titleScale");
    const agencyScale = params.get("agencyScale");
    const style =
      font || bg || titleScale || agencyScale
        ? {
            fontDisplay: font || undefined,
            background: bg || undefined,
            titleScale: titleScale ? Number(titleScale) : undefined,
            agencyScale: agencyScale ? Number(agencyScale) : undefined,
          }
        : undefined;
    return (
      <AgentOfWeekCard
        agencyName="THE STANDARD"
        network={NETWORK}
        periodLabel="WEEK OF JUN 14–20"
        agent={{
          name: toLastInitial("Marcus Webb"),
          ap: 52400,
          policies: 31,
          photoUrl: "https://i.pravatar.cc/640?img=12",
        }}
        format={format}
        design={
          (params.get("design") as AowDesign) ||
          (
            {
              spotlight: "aurora",
              editorial: "editorial",
              lift: "noir",
            } as const
          )[cardTheme]
        }
        style={style}
      />
    );
  }

  if (view === "monthly") {
    return (
      <MonthlyReportCard
        agencyName={AGENCY}
        network={NETWORK}
        monthLabel="JUNE 2026"
        totalAp={1284500}
        stats={[
          { label: "POLICIES", value: "642" },
          { label: "AGENTS", value: "18" },
          { label: "AVG AP / AGENT", value: "$71,361" },
        ]}
        topPerformer={{
          name: toLastInitial("Marcus Webb"),
          ap: 184200,
          policies: 92,
        }}
        top={[
          { rank: 1, name: toLastInitial("Marcus Webb"), ap: 184200 },
          { rank: 2, name: toLastInitial("Alyssa Chen"), ap: 156800 },
          { rank: 3, name: toLastInitial("Priya Nair"), ap: 142300 },
          { rank: 4, name: toLastInitial("Jordan Mercer"), ap: 128900 },
          { rank: 5, name: toLastInitial("Devon Brooks"), ap: 112400 },
        ]}
        growthLabel="+18% vs MAY"
        format={format}
        theme={cardTheme}
      />
    );
  }

  const isWeekly = view === "weekly";
  const data = isWeekly
    ? rows(WEEKLY_AP, WEEKLY_POL)
    : rows(DAILY_AP, DAILY_POL);
  const totalAp = data.reduce((s, r) => s + r.ap, 0);
  const periodLabel = isWeekly ? "WEEKLY · JUN 14–20" : "DAILY · JUN 20, 2026";

  return (
    <LeaderboardSocialCard
      agencyName={AGENCY}
      network={NETWORK}
      periodLabel={periodLabel}
      rows={data}
      totalAp={totalAp}
      format={format}
      theme={cardTheme}
    />
  );
}

function App() {
  // The screenshotter targets #card. The card components no longer carry that id
  // (it collided when the studio's library mounts many cards at once), so the
  // harness — which renders exactly ONE card — supplies it on the wrapper.
  return (
    <div id="card" className={wrapperClass} style={{ display: "inline-block" }}>
      <Card />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

// scale:1 → exactly 1080px, matching the in-app download (SocialStudioPage).
window.__domToPng = () =>
  domToPng(document.getElementById("card")!, { scale: 1 });

async function ready() {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  // Wait for any <img> (agent photos) to finish loading before the screenshot.
  await Promise.all(
    Array.from(document.images).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          }),
    ),
  );
  await new Promise((r) => setTimeout(r, 200));
  window.__READY__ = true;
}
void ready();
