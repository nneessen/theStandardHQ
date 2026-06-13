// src/features/call-reviews/components/scripts/ScriptPdfDocument.tsx
// A self-contained, downloadable PDF rendering of an AI master sales script.
//
// This is the "right way" replacement for the old window.print() on the live
// page (which rasterized the whole app, sidebar included). It builds a real,
// selectable-text document straight from the structured GeneratedScript JSON —
// so the app shell can never bleed in, and the output is a properly labeled,
// paginated artifact an agent can read or hand out.
//
// FULL DETAIL by design: every annotation the model produced is emitted (the
// on-screen "Call mode" fold does not apply here). Field-for-field this mirrors
// flattenScript() in ScriptDetailPage and the section semantics of
// GeneratedScriptView — keep all three in lockstep.
//
// Heavy dependency (@react-pdf/renderer): only ever import this module via a
// dynamic import() from the download handler, never statically into the route.

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { GeneratedScript, ScriptPhase, ScriptStep } from "../../types";

// Mirrors KIND_LABEL in GeneratedScriptView, upper-cased for the print badge.
const KIND_LABEL: Record<string, string> = {
  say: "SAY",
  ask: "ASK",
  do: "DO",
  transition: "NEXT",
};

// Muted, professional palette — no theme tokens (this renders outside the DOM).
const C = {
  ink: "#1a1a1a",
  body: "#2b2b2b",
  muted: "#6b6b6b",
  subtle: "#8a8a8a",
  accent: "#1d4ed8",
  rule: "#d8d8d8",
  ruleSoft: "#ececec",
  band: "#f3f5fb",
  objBorder: "#e3c98a",
  objBand: "#fbf6e9",
  objInk: "#7a5b14",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 54,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: C.body,
    lineHeight: 1.45,
  },
  // Title block
  title: { fontFamily: "Helvetica-Bold", fontSize: 22, color: C.ink },
  subtitle: { fontSize: 9.5, color: C.subtle, marginTop: 4 },
  titleRule: {
    marginTop: 12,
    marginBottom: 18,
    borderBottomWidth: 1.5,
    borderBottomColor: C.accent,
  },
  // Generic section
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.2,
    color: C.accent,
    marginBottom: 6,
  },
  summary: { fontSize: 11.5, color: C.ink, marginBottom: 16, lineHeight: 1.5 },
  principlesBlock: { marginBottom: 18 },
  bulletRow: { flexDirection: "row", marginBottom: 4 },
  bulletDot: { color: C.accent, fontFamily: "Helvetica-Bold", marginRight: 6 },
  bulletText: { flex: 1, color: C.body },
  // Phase
  phase: { marginBottom: 16 },
  phaseHeader: {
    backgroundColor: C.band,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  phaseHeaderTop: { flexDirection: "row", alignItems: "center" },
  phaseTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: C.ink,
    flex: 1,
  },
  phaseMeta: { fontSize: 9, color: C.muted },
  phaseGoal: { fontSize: 10, color: C.muted, marginTop: 4, lineHeight: 1.4 },
  phaseTone: { fontSize: 9, color: C.muted, marginTop: 3 },
  // Step
  step: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.ruleSoft,
  },
  stepTopRow: { flexDirection: "row" },
  kindBadge: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 0.8,
    color: C.accent,
    width: 34,
    paddingTop: 2,
  },
  stepHero: {
    flex: 1,
    fontSize: 11.5,
    color: C.ink,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.45,
  },
  // Step coaching sub-rows
  subRow: { marginTop: 4, marginLeft: 34, flexDirection: "row" },
  subLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 0.5,
    color: C.subtle,
    width: 78,
    paddingTop: 1,
  },
  subText: { flex: 1, fontSize: 9.5, color: C.muted, lineHeight: 1.4 },
  subTextItalic: {
    flex: 1,
    fontSize: 9.5,
    color: C.muted,
    fontFamily: "Helvetica-Oblique",
    lineHeight: 1.4,
  },
  // Objections
  objBlock: {
    marginTop: 8,
    marginLeft: 34,
    backgroundColor: C.objBand,
    borderWidth: 1,
    borderColor: C.objBorder,
    borderRadius: 3,
    padding: 8,
  },
  objLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 0.8,
    color: C.objInk,
    marginBottom: 5,
  },
  objItem: { marginBottom: 6 },
  objText: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 10,
    color: C.ink,
  },
  objType: { fontSize: 8, color: C.muted, fontFamily: "Helvetica" },
  objRebuttal: {
    fontSize: 10,
    color: C.body,
    marginTop: 2,
    paddingLeft: 8,
    borderLeftWidth: 1.5,
    borderLeftColor: "#3ea06b",
  },
  objTone: {
    fontSize: 8.5,
    color: C.muted,
    fontFamily: "Helvetica-Oblique",
    marginTop: 2,
    paddingLeft: 8,
  },
  // Placeholders
  placeholderBlock: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
  placeholderText: { fontSize: 9.5, color: C.muted, fontFamily: "Courier" },
  // Footer page number
  pageNo: {
    position: "absolute",
    bottom: 28,
    left: 54,
    right: 54,
    textAlign: "center",
    fontSize: 8,
    color: C.subtle,
  },
});

interface ScriptPdfDocumentProps {
  callTypeName: string;
  script: GeneratedScript;
  /** id → label for the IMO word-track library (chips resolve via this). */
  wordTrackMap: Map<string, string>;
  generatedAt?: string | null;
  sourceCallCount?: number | null;
}

export function ScriptPdfDocument({
  callTypeName,
  script,
  wordTrackMap,
  generatedAt,
  sourceCallCount,
}: ScriptPdfDocumentProps) {
  const phases = Array.isArray(script.phases) ? script.phases : [];
  const principles = script.key_principles ?? [];
  const placeholders = script.placeholders_used ?? [];

  const subtitleParts: string[] = [];
  if (generatedAt) {
    subtitleParts.push(
      `Generated ${new Date(generatedAt).toLocaleDateString()}`,
    );
  }
  if (sourceCallCount != null) {
    subtitleParts.push(
      `from ${sourceCallCount} sold call${sourceCallCount === 1 ? "" : "s"}`,
    );
  }
  const subtitle = subtitleParts.join(" · ");

  return (
    <Document title={`${callTypeName} — Sales Script`}>
      <Page size="A4" style={styles.page}>
        {/* Title block */}
        <View>
          <Text style={styles.title}>{callTypeName}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.titleRule} />
        </View>

        {script.summary ? (
          <Text style={styles.summary}>{script.summary}</Text>
        ) : null}

        {principles.length > 0 ? (
          <View style={styles.principlesBlock}>
            <Text style={styles.sectionLabel}>KEY PRINCIPLES</Text>
            {principles.map((p, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{p}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {phases.map((phase, i) => (
          <PhaseBlock
            key={i}
            phase={phase}
            index={i}
            wordTrackMap={wordTrackMap}
          />
        ))}

        {placeholders.length > 0 ? (
          <View style={styles.placeholderBlock}>
            <Text style={styles.sectionLabel}>FILL IN THE BLANKS</Text>
            <Text style={styles.placeholderText}>
              {placeholders.join("   ")}
            </Text>
          </View>
        ) : null}

        <Text
          style={styles.pageNo}
          render={({ pageNumber, totalPages }) =>
            `${callTypeName}  ·  ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

function PhaseBlock({
  phase,
  index,
  wordTrackMap,
}: {
  phase: ScriptPhase;
  index: number;
  wordTrackMap: Map<string, string>;
}) {
  const steps = Array.isArray(phase.steps) ? phase.steps : [];
  const meta: string[] = [];
  // Treat 0 as "unknown" — matches PhaseCard in GeneratedScriptView.
  if (phase.est_minutes != null && phase.est_minutes > 0)
    meta.push(`~${phase.est_minutes} min`);
  if (phase.call_pct != null && phase.call_pct > 0)
    meta.push(`${phase.call_pct}%`);

  return (
    <View style={styles.phase} wrap>
      {/* Keep the header glued to at least its first step where possible. */}
      <View style={styles.phaseHeader} wrap={false}>
        <View style={styles.phaseHeaderTop}>
          <Text style={styles.phaseTitle}>
            PHASE {index + 1} · {phase.title}
          </Text>
          {meta.length > 0 ? (
            <Text style={styles.phaseMeta}>{meta.join(" · ")}</Text>
          ) : null}
        </View>
        {phase.goal ? <Text style={styles.phaseGoal}>{phase.goal}</Text> : null}
        {phase.tonality ? (
          <Text style={styles.phaseTone}>Tone: {phase.tonality}</Text>
        ) : null}
      </View>

      {steps.map((step, i) => (
        <StepBlock key={i} step={step} wordTrackMap={wordTrackMap} />
      ))}
    </View>
  );
}

function StepBlock({
  step,
  wordTrackMap,
}: {
  step: ScriptStep;
  wordTrackMap: Map<string, string>;
}) {
  const kindLabel = KIND_LABEL[step.kind] ?? "SAY";
  const mainText = step.kind === "do" ? step.do : step.say;
  const extraDo = step.kind !== "do" && step.do ? step.do : "";
  const chips = (step.word_track_ids ?? [])
    .map((id) => wordTrackMap.get(id))
    .filter((label): label is string => !!label);
  const objections = step.objections ?? [];

  return (
    <View style={styles.step} wrap={false}>
      <View style={styles.stepTopRow}>
        <Text style={styles.kindBadge}>{kindLabel}</Text>
        <Text style={styles.stepHero}>{mainText}</Text>
      </View>

      {step.delivery_note ? (
        <View style={styles.subRow}>
          <Text style={styles.subLabel}>NOTE</Text>
          <Text style={styles.subTextItalic}>{step.delivery_note}</Text>
        </View>
      ) : null}

      {step.tonality ? (
        <View style={styles.subRow}>
          <Text style={styles.subLabel}>TONE</Text>
          <Text style={styles.subText}>{step.tonality}</Text>
        </View>
      ) : null}

      {step.pause_cue ? (
        <View style={styles.subRow}>
          <Text style={styles.subLabel}>PAUSE</Text>
          <Text style={styles.subText}>{step.pause_cue}</Text>
        </View>
      ) : null}

      {extraDo ? (
        <View style={styles.subRow}>
          <Text style={styles.subLabel}>DO</Text>
          <Text style={styles.subText}>{extraDo}</Text>
        </View>
      ) : null}

      {chips.length > 0 ? (
        <View style={styles.subRow}>
          <Text style={styles.subLabel}>WORD TRACKS</Text>
          <Text style={styles.subText}>{chips.join("  ·  ")}</Text>
        </View>
      ) : null}

      {step.why_it_works ? (
        <View style={styles.subRow}>
          <Text style={styles.subLabel}>WHY IT WORKS</Text>
          <Text style={styles.subText}>{step.why_it_works}</Text>
        </View>
      ) : null}

      {objections.length > 0 ? (
        <View style={styles.objBlock} wrap={false}>
          <Text style={styles.objLabel}>IF THEY PUSH BACK</Text>
          {objections.map((o, i) => (
            <View key={i} style={styles.objItem}>
              <Text>
                <Text style={styles.objText}>“{o.objection}”</Text>
                {o.type ? (
                  <Text style={styles.objType}>
                    {"  "}
                    {o.type.replace(/_/g, " ")}
                  </Text>
                ) : null}
              </Text>
              <Text style={styles.objRebuttal}>→ {o.rebuttal}</Text>
              {o.tonality ? (
                <Text style={styles.objTone}>{o.tonality}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
