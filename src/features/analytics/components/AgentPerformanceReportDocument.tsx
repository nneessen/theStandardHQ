// src/features/analytics/components/AgentPerformanceReportDocument.tsx
// Downloadable PDF of the team's Agent Performance table. Built from the
// already-computed leaderboard rows (never the live DOM) so the output is a
// labeled, paginated, selectable-text artifact. Mirrors the brand styling of
// AnalyticsReportDocument (dark header band + indigo accent rule + slate ink).
//
// Heavy dependency (@react-pdf/renderer): only ever import this module via a
// dynamic import() from the download handler, never statically into the route.

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/format";

const C = {
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  subtle: "#94a3b8",
  accent: "#4f46e5",
  accentSoft: "#eef2ff",
  rule: "#e2e8f0",
  card: "#f8fafc",
  white: "#ffffff",
  green: "#15803d",
};

export interface AgentPerformanceReportRow {
  rank: number;
  agent: string;
  policies: number;
  ap: number;
  ip: number;
}

export interface AgentPerformanceReportData {
  periodLabel: string;
  generatedAt: string;
  preparedFor?: string | null;
  rows: AgentPerformanceReportRow[];
  totals: { agents: number; policies: number; ap: number; ip: number };
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 42,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: C.body,
    lineHeight: 1.45,
  },
  header: {
    backgroundColor: C.ink,
    paddingTop: 28,
    paddingBottom: 16,
    paddingHorizontal: 54,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  eyebrow: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    letterSpacing: 2,
    color: C.subtle,
    marginBottom: 6,
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 26,
    color: C.white,
    lineHeight: 1.1,
  },
  period: { fontSize: 11, color: "#cbd5e1", marginTop: 10 },
  headerMeta: { textAlign: "right" },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 1,
    color: C.subtle,
  },
  metaValue: { fontSize: 10.5, color: C.white, marginTop: 2 },
  accentRule: { height: 4, backgroundColor: C.accent },
  body: { paddingHorizontal: 54, paddingTop: 18 },
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.2,
    color: C.accent,
    marginBottom: 8,
  },
  table: { borderWidth: 1, borderColor: C.rule, borderRadius: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.rule },
  trLast: { flexDirection: "row" },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 0.8,
    color: C.muted,
    textTransform: "uppercase",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: C.card,
  },
  td: {
    fontSize: 10.5,
    color: C.ink,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  colRank: { width: 36 },
  colAgent: { flex: 1 },
  colNum: { width: 90, textAlign: "right" },
  totalRow: { backgroundColor: C.accentSoft },
  totalText: { fontFamily: "Helvetica-Bold", color: C.ink },
  ipText: { color: C.green },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.rule,
    paddingTop: 8,
  },
  footerText: { fontSize: 8, color: C.subtle },
});

export function AgentPerformanceReportDocument({
  data,
}: {
  data: AgentPerformanceReportData;
}) {
  const { periodLabel, generatedAt, preparedFor, rows, totals } = data;

  return (
    <Document title="Agent Performance" author="Commission Tracker">
      <Page size="A4" style={styles.page}>
        {/* Header band */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.eyebrow}>TEAM</Text>
              <Text style={styles.title}>Agent Performance</Text>
              <Text style={styles.period}>{periodLabel}</Text>
            </View>
            <View style={styles.headerMeta}>
              {preparedFor ? (
                <>
                  <Text style={styles.metaLabel}>PREPARED BY</Text>
                  <Text style={styles.metaValue}>{preparedFor}</Text>
                </>
              ) : null}
              <Text
                style={[styles.metaLabel, { marginTop: preparedFor ? 8 : 0 }]}
              >
                GENERATED
              </Text>
              <Text style={styles.metaValue}>{generatedAt}</Text>
            </View>
          </View>
        </View>
        <View style={styles.accentRule} />

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>
            {totals.agents} AGENT{totals.agents === 1 ? "" : "S"}
          </Text>
          <View style={styles.table}>
            {/* Head */}
            <View style={styles.tr}>
              <Text style={[styles.th, styles.colRank]}>#</Text>
              <Text style={[styles.th, styles.colAgent]}>Agent</Text>
              <Text style={[styles.th, styles.colNum]}>Policies</Text>
              <Text style={[styles.th, styles.colNum]}>AP</Text>
              <Text style={[styles.th, styles.colNum]}>IP</Text>
            </View>
            {/* Rows */}
            {rows.map((r) => (
              <View key={`${r.rank}-${r.agent}`} style={styles.tr}>
                <Text style={[styles.td, styles.colRank]}>{r.rank}</Text>
                <Text style={[styles.td, styles.colAgent]}>{r.agent}</Text>
                <Text style={[styles.td, styles.colNum]}>{r.policies}</Text>
                <Text style={[styles.td, styles.colNum]}>
                  {formatCurrency(r.ap)}
                </Text>
                <Text style={[styles.td, styles.colNum, styles.ipText]}>
                  {formatCurrency(r.ip)}
                </Text>
              </View>
            ))}
            {/* Totals */}
            <View style={[styles.trLast, styles.totalRow]}>
              <Text style={[styles.td, styles.colRank, styles.totalText]} />
              <Text style={[styles.td, styles.colAgent, styles.totalText]}>
                Team total
              </Text>
              <Text style={[styles.td, styles.colNum, styles.totalText]}>
                {totals.policies}
              </Text>
              <Text style={[styles.td, styles.colNum, styles.totalText]}>
                {formatCurrency(totals.ap)}
              </Text>
              <Text style={[styles.td, styles.colNum, styles.totalText]}>
                {formatCurrency(totals.ip)}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 9, color: C.muted, marginTop: 10 }}>
            AP = annual premium (submitted policies). IP = issued premium
            (active policies with paid commissions). Ranked by IP.
          </Text>
        </View>

        {/* Footer — STATIC children only. A dynamic render callback on a fixed
            element crashes @react-pdf v4 on 3+ page docs. */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Commission Tracker · Agent Performance
          </Text>
          <Text style={styles.footerText}>{periodLabel}</Text>
        </View>
      </Page>
    </Document>
  );
}
