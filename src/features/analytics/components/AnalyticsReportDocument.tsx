// src/features/analytics/components/AnalyticsReportDocument.tsx
// A self-contained, downloadable PDF analytics report. Built straight from
// already-computed KPI data (never the live DOM) so the app shell can't bleed in
// and the output is a properly labeled, paginated, selectable-text artifact.
//
// This replaces the old window.print() HTML report (a serif "Goldman Sachs"
// theme that matched nothing in the app and only printed two integer counts).
//
// Heavy dependency (@react-pdf/renderer): only ever import this module via a
// dynamic import() from the download handler, never statically into the route.

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/format";

// Brand-aligned palette — hardcoded hex. Theme tokens / var() do NOT resolve
// outside the DOM in react-pdf, so we mirror the app's v2 indigo accent + slate
// ink as literals.
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
  amber: "#b45309",
  red: "#b91c1c",
};

export interface AnalyticsReportStatus {
  active: number;
  pending: number;
  lapsed: number;
  cancelled: number;
  // Approved-but-not-yet-in-force + any non-issued applications — i.e. every
  // policy in the period that isn't active/pending/lapsed/cancelled. Keeps the
  // table reconciled to the Summary policy count (no "4 policies but total 3").
  other: number;
  total: number;
}

export interface AnalyticsReportPersistency {
  bucketMonths: number;
  activeCount: number;
  issuedCount: number;
  persistencyRate: number | null;
}

export interface AnalyticsReportData {
  periodLabel: string;
  generatedAt: string;
  agentName?: string | null;
  totalPolicies: number;
  totalAnnualPremium: number;
  avgPremium: number;
  commissionsPaid: number;
  commissionsPaidCount: number;
  status: AnalyticsReportStatus;
  persistency: AnalyticsReportPersistency[];
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
  // Header band
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
  // Body
  body: { paddingHorizontal: 54, paddingTop: 18 },
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.2,
    color: C.accent,
    marginBottom: 8,
  },
  section: { marginBottom: 18 },
  // KPI cards
  cardRow: { flexDirection: "row", gap: 10 },
  card: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  cardLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 0.8,
    color: C.muted,
    textTransform: "uppercase",
  },
  cardValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 17,
    color: C.ink,
    marginTop: 6,
  },
  cardSub: { fontSize: 8.5, color: C.subtle, marginTop: 3 },
  // Status table
  table: { borderWidth: 1, borderColor: C.rule, borderRadius: 6 },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  trLast: { flexDirection: "row" },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 0.8,
    color: C.muted,
    textTransform: "uppercase",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: C.card,
  },
  td: {
    fontSize: 10.5,
    color: C.ink,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  colStatus: { flex: 2 },
  colNum: { flex: 1, textAlign: "right" },
  totalRow: { backgroundColor: C.accentSoft },
  totalText: { fontFamily: "Helvetica-Bold", color: C.ink },
  // Persistency
  persRow: { flexDirection: "row", gap: 10 },
  persCell: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  persLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 0.8,
    color: C.muted,
    textTransform: "uppercase",
  },
  persValue: { fontFamily: "Helvetica-Bold", fontSize: 22, marginTop: 6 },
  persSub: { fontSize: 8, color: C.subtle, marginTop: 3 },
  note: { fontSize: 9, color: C.muted, marginTop: 10, lineHeight: 1.5 },
  // Footer
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

function persToneHex(rate: number | null): string {
  if (rate == null) return C.subtle;
  if (rate >= 85) return C.green;
  if (rate >= 70) return C.amber;
  return C.red;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
    </View>
  );
}

function StatusRow({
  label,
  count,
  total,
  last,
  isTotal,
}: {
  label: string;
  count: number;
  total: number;
  last?: boolean;
  isTotal?: boolean;
}) {
  const share = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View
      style={[
        last ? styles.trLast : styles.tr,
        ...(isTotal ? [styles.totalRow] : []),
      ]}
    >
      <Text
        style={[
          styles.td,
          styles.colStatus,
          ...(isTotal ? [styles.totalText] : []),
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.td,
          styles.colNum,
          ...(isTotal ? [styles.totalText] : []),
        ]}
      >
        {count}
      </Text>
      <Text
        style={[
          styles.td,
          styles.colNum,
          ...(isTotal ? [styles.totalText] : []),
        ]}
      >
        {isTotal ? "100%" : `${share}%`}
      </Text>
    </View>
  );
}

export function AnalyticsReportDocument({
  data,
}: {
  data: AnalyticsReportData;
}) {
  const {
    periodLabel,
    generatedAt,
    agentName,
    totalPolicies,
    totalAnnualPremium,
    avgPremium,
    commissionsPaid,
    commissionsPaidCount,
    status,
    persistency,
  } = data;

  return (
    <Document title="Analytics Report" author="Commission Tracker">
      <Page size="A4" style={styles.page}>
        {/* Header band */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.eyebrow}>PERFORMANCE</Text>
              <Text style={styles.title}>Analytics Report</Text>
              <Text style={styles.period}>{periodLabel}</Text>
            </View>
            <View style={styles.headerMeta}>
              {agentName ? (
                <>
                  <Text style={styles.metaLabel}>PREPARED FOR</Text>
                  <Text style={styles.metaValue}>{agentName}</Text>
                </>
              ) : null}
              <Text
                style={[styles.metaLabel, { marginTop: agentName ? 8 : 0 }]}
              >
                GENERATED
              </Text>
              <Text style={styles.metaValue}>{generatedAt}</Text>
            </View>
          </View>
        </View>
        <View style={styles.accentRule} />

        <View style={styles.body}>
          {/* Summary KPIs */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SUMMARY</Text>
            <View style={styles.cardRow}>
              <StatCard label="Policies" value={String(totalPolicies)} />
              <StatCard
                label="Annual Premium"
                value={formatCurrency(totalAnnualPremium)}
              />
              <StatCard
                label="Avg Premium"
                value={formatCurrency(avgPremium)}
                sub="per policy"
              />
              <StatCard
                label="Commissions Paid"
                value={formatCurrency(commissionsPaid)}
                sub={`${commissionsPaidCount} payment${commissionsPaidCount === 1 ? "" : "s"}`}
              />
            </View>
          </View>

          {/* Policy status */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>POLICY STATUS</Text>
            <View style={styles.table}>
              <View style={styles.tr}>
                <Text style={[styles.th, styles.colStatus]}>Status</Text>
                <Text style={[styles.th, styles.colNum]}>Policies</Text>
                <Text style={[styles.th, styles.colNum]}>Share</Text>
              </View>
              <StatusRow
                label="Active (in force)"
                count={status.active}
                total={status.total}
              />
              <StatusRow
                label="Pending (underwriting)"
                count={status.pending}
                total={status.total}
              />
              <StatusRow
                label="Lapsed"
                count={status.lapsed}
                total={status.total}
              />
              <StatusRow
                label="Cancelled"
                count={status.cancelled}
                total={status.total}
              />
              {status.other > 0 ? (
                <StatusRow
                  label="Other (not yet in force)"
                  count={status.other}
                  total={status.total}
                />
              ) : null}
              <StatusRow
                label="Total"
                count={status.total}
                total={status.total}
                last
                isTotal
              />
            </View>
            {status.other > 0 ? (
              <Text style={styles.note}>
                Total reflects every policy written in the period. “Other (not
                yet in force)” covers approved policies awaiting an active
                status and non-issued applications.
              </Text>
            ) : null}
          </View>

          {/* Persistency */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PERSISTENCY</Text>
            <View style={styles.persRow}>
              {persistency.map((b) => {
                const hasData = b.persistencyRate != null && b.issuedCount > 0;
                return (
                  <View key={b.bucketMonths} style={styles.persCell}>
                    <Text style={styles.persLabel}>{b.bucketMonths}-Month</Text>
                    <Text
                      style={[
                        styles.persValue,
                        {
                          color: persToneHex(
                            hasData ? b.persistencyRate : null,
                          ),
                        },
                      ]}
                    >
                      {hasData
                        ? `${Math.round(b.persistencyRate as number)}%`
                        : "—"}
                    </Text>
                    <Text style={styles.persSub}>
                      {hasData
                        ? `${b.activeCount} of ${b.issuedCount} active`
                        : "no cohort yet"}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.note}>
              Persistency is the share of issued policies that have reached each
              milestone and are still in force. Each milestone is a cumulative
              cohort, so the longer windows are subsets of the shorter ones.
            </Text>
          </View>
        </View>

        {/* Footer — STATIC children only. A dynamic render={({pageNumber})=>…}
            callback on a fixed element crashes @react-pdf v4 on 3+ page docs
            ("unsupported number: -9.4…e+21"). Do not reintroduce page numbers
            via a render callback here. */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Commission Tracker · Analytics</Text>
          <Text style={styles.footerText}>{periodLabel}</Text>
        </View>
      </Page>
    </Document>
  );
}
