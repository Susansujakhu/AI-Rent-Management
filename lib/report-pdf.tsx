import React from "react";
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

// ─── Shared PDF styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:      { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1f2937" },
  header:    { marginBottom: 16, borderBottomWidth: 2, borderBottomColor: "#4f46e5", paddingBottom: 8 },
  title:     { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#1f2937" },
  subtitle:  { fontSize: 10, color: "#64748b", marginTop: 2 },
  meta:      { fontSize: 9, color: "#94a3b8", marginTop: 6 },
  table:     { marginTop: 4 },
  trHeader:  { flexDirection: "row", backgroundColor: "#eef2ff", paddingVertical: 6, paddingHorizontal: 4, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#c7d2fe" },
  tr:        { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  trAlt:     { backgroundColor: "#fafafa" },
  th:        { fontFamily: "Helvetica-Bold", color: "#3730a3", fontSize: 8 },
  td:        { fontSize: 8.5 },
  right:     { textAlign: "right" },
  totals:    { flexDirection: "row", marginTop: 12, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#cbd5e1" },
  totalsLbl: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  footer:    { position: "absolute", bottom: 16, left: 32, right: 32, fontSize: 7, color: "#94a3b8", textAlign: "center" },
});

// ─── Reusable building blocks ─────────────────────────────────────────────────
function ReportHeader({ title, subtitle, generated }: { title: string; subtitle: string; generated: string }) {
  return (
    <View style={s.header}>
      <Text style={s.title}>{title}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>
      <Text style={s.meta}>Generated {generated}</Text>
    </View>
  );
}

function Row({ cells, widths, alt, header, alignRight }: {
  cells: (string | number)[];
  widths: number[];
  alt?: boolean;
  header?: boolean;
  alignRight?: boolean[];
}) {
  const style = header ? s.trHeader : alt ? [s.tr, s.trAlt] : s.tr;
  const cellStyle = header ? s.th : s.td;
  return (
    <View style={style}>
      {cells.map((c, i) => (
        <View key={i} style={{ width: `${widths[i]}%` }}>
          <Text style={[cellStyle, alignRight?.[i] ? s.right : {}]}>{String(c)}</Text>
        </View>
      ))}
    </View>
  );
}

function PageFooter() {
  return <Text style={s.footer} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />;
}

// ─── Report types ─────────────────────────────────────────────────────────────
export interface SummaryRow { month: string; due: number; col: number; rate: string; exp: number; net: number }
export interface PaymentRow { month: string; tenant: string; room: string; due: number; paid: number; balance: number; status: string; paidDate: string; method: string }
export interface ExpenseRow { date: string; title: string; category: string; amount: number; room: string; description: string }
export interface TenantRow  { name: string; phone: string; email: string; room: string; moveIn: string; moveOut: string; deposit: number; credit: number; status: string }

interface CommonProps { title: string; subtitle: string; generated: string; sym: string }

function fmt(n: number, sym: string) {
  return `${sym}${n.toLocaleString("en", { maximumFractionDigits: 0 })}`;
}

export function SummaryDocument({ title, subtitle, generated, sym, rows, totals }: CommonProps & {
  rows: SummaryRow[]; totals: { due: number; col: number; exp: number; net: number };
}) {
  const widths     = [22, 16, 16, 14, 16, 16];
  const alignRight = [false, true, true, true, true, true];
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <ReportHeader title={title} subtitle={subtitle} generated={generated} />
        <View style={s.table}>
          <Row cells={["Month", `Rent Due (${sym})`, `Collected (${sym})`, "Rate", `Expenses (${sym})`, `Net (${sym})`]}
               widths={widths} alignRight={alignRight} header />
          {rows.map((r, i) => (
            <Row key={i} alt={i % 2 === 1} widths={widths} alignRight={alignRight}
              cells={[r.month, fmt(r.due, sym), fmt(r.col, sym), r.rate, fmt(r.exp, sym), fmt(r.net, sym)]} />
          ))}
        </View>
        <View style={s.totals}>
          <View style={{ width: "22%" }}><Text style={s.totalsLbl}>TOTAL</Text></View>
          <View style={{ width: "16%" }}><Text style={[s.totalsLbl, s.right]}>{fmt(totals.due, sym)}</Text></View>
          <View style={{ width: "16%" }}><Text style={[s.totalsLbl, s.right]}>{fmt(totals.col, sym)}</Text></View>
          <View style={{ width: "14%" }}><Text style={[s.totalsLbl, s.right]}>{totals.due > 0 ? `${Math.round((totals.col / totals.due) * 100)}%` : "—"}</Text></View>
          <View style={{ width: "16%" }}><Text style={[s.totalsLbl, s.right]}>{fmt(totals.exp, sym)}</Text></View>
          <View style={{ width: "16%" }}><Text style={[s.totalsLbl, s.right]}>{fmt(totals.net, sym)}</Text></View>
        </View>
        <PageFooter />
      </Page>
    </Document>
  );
}

export function PaymentsDocument({ title, subtitle, generated, sym, rows }: CommonProps & { rows: PaymentRow[] }) {
  const widths     = [10, 18, 12, 11, 11, 11, 10, 10, 7];
  const alignRight = [false, false, false, true, true, true, false, false, false];
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <ReportHeader title={title} subtitle={subtitle} generated={generated} />
        <View style={s.table}>
          <Row cells={["Month", "Tenant", "Room", `Due (${sym})`, `Paid (${sym})`, `Balance (${sym})`, "Status", "Paid Date", "Method"]}
               widths={widths} alignRight={alignRight} header />
          {rows.map((r, i) => (
            <Row key={i} alt={i % 2 === 1} widths={widths} alignRight={alignRight}
              cells={[r.month, r.tenant, r.room, fmt(r.due, sym), fmt(r.paid, sym), fmt(r.balance, sym), r.status, r.paidDate, r.method]} />
          ))}
        </View>
        <PageFooter />
      </Page>
    </Document>
  );
}

export function ExpensesDocument({ title, subtitle, generated, sym, rows }: CommonProps & { rows: ExpenseRow[] }) {
  const widths     = [12, 22, 14, 13, 14, 25];
  const alignRight = [false, false, false, true, false, false];
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <ReportHeader title={title} subtitle={subtitle} generated={generated} />
        <View style={s.table}>
          <Row cells={["Date", "Title", "Category", `Amount (${sym})`, "Room", "Description"]}
               widths={widths} alignRight={alignRight} header />
          {rows.map((r, i) => (
            <Row key={i} alt={i % 2 === 1} widths={widths} alignRight={alignRight}
              cells={[r.date, r.title, r.category, fmt(r.amount, sym), r.room, r.description]} />
          ))}
        </View>
        <PageFooter />
      </Page>
    </Document>
  );
}

export function TenantsDocument({ title, subtitle, generated, sym, rows }: CommonProps & { rows: TenantRow[] }) {
  const widths     = [16, 12, 18, 10, 10, 10, 10, 10, 4];
  const alignRight = [false, false, false, false, false, false, true, true, false];
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <ReportHeader title={title} subtitle={subtitle} generated={generated} />
        <View style={s.table}>
          <Row cells={["Name", "Phone", "Email", "Room", "Move-in", "Move-out", `Deposit (${sym})`, `Credit (${sym})`, "Status"]}
               widths={widths} alignRight={alignRight} header />
          {rows.map((r, i) => (
            <Row key={i} alt={i % 2 === 1} widths={widths} alignRight={alignRight}
              cells={[r.name, r.phone, r.email, r.room, r.moveIn, r.moveOut, fmt(r.deposit, sym), fmt(r.credit, sym), r.status]} />
          ))}
        </View>
        <PageFooter />
      </Page>
    </Document>
  );
}

// ─── Render helper ────────────────────────────────────────────────────────────
export async function renderPdf(doc: React.ReactElement): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(doc as any);
}
