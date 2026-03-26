import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, ChevronDown, Download, Eye } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
// XLSX loaded via CDN
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const XLSX: any;
import { Layout } from "../components/Layout";
import { useData } from "../context/DataContext";
import type { KPIResult } from "../types/index";

// ── Shared helpers ───────────────────────────────────────────────────────────
function getZoneAvgRos(k: KPIResult, allKPIs: KPIResult[]): number {
  const zoneItems = allKPIs.filter((x) => x.category === k.category);
  if (!zoneItems.length) return k.ros || 1;
  const avg = zoneItems.reduce((s, x) => s + x.ros, 0) / zoneItems.length;
  return avg || 1;
}

function getAction(k: KPIResult): string {
  if (k.inventoryCoverWeeks > 10 && k.ros < 4) return "Markdown";
  if (k.classification === "Re-buy Candidate") return "Rebuy";
  if (k.classification === "Do Not Re-buy") return "Exit";
  return "Hold";
}

function getMomentum(k: KPIResult): string {
  if (k.ros >= 8 && k.inventoryCoverWeeks < 5) return "Increasing";
  if (k.ros >= 4) return "Stable";
  return "Declining";
}

function getHealthLabel(k: KPIResult): string {
  const cover = Math.max(0.1, k.inventoryCoverWeeks);
  const sellThrough = Math.min(1, 8 / (8 + cover));
  const score = sellThrough * 0.6 + (1 / cover) * 0.4;
  return score >= 0.7 ? "Healthy" : score >= 0.4 ? "Medium" : "Poor";
}

function getSmartRecommendation(k: KPIResult, allKPIs: KPIResult[]): string {
  const zoneAvg = getZoneAvgRos(k, allKPIs);
  const perfIdx = zoneAvg > 0 ? k.ros / zoneAvg : 1;
  const perfLabel =
    perfIdx > 1.2
      ? "High Performer"
      : perfIdx >= 0.8
        ? "Stable"
        : "Low Performer";
  const cover = k.inventoryCoverWeeks;
  const stockStatus =
    cover > 10 ? "Overstocked" : cover >= 5 ? "Balanced" : "Understocked";
  const action = getAction(k);
  if (perfLabel === "High Performer" && stockStatus === "Understocked")
    return "Strong performer with low cover — immediate replenishment required.";
  if (perfLabel === "Low Performer" && stockStatus === "Overstocked")
    return "Slow moving with high stock — initiate markdown.";
  if (perfLabel === "Stable" && action === "Rebuy")
    return "Stable performance — controlled rebuy recommended.";
  if (action === "Exit")
    return "Weak velocity — recommend exit. Avoid further commitment.";
  if (stockStatus === "Overstocked")
    return "High stock cover — monitor closely before any rebuy.";
  if (perfLabel === "High Performer")
    return "High performer — maintain supply to avoid stockout.";
  return "Average performer — review trend before placing order.";
}

// ── Excel export functions ───────────────────────────────────────────────────
function exportRebuyPlanning(data: KPIResult[]) {
  const rows = data
    .filter((k) => k.classification === "Re-buy Candidate")
    .map((k) => {
      const rebuyQty = Math.round(k.ros * 4 * (k.buyingScore / 100) * 10) * 10;
      return [
        k.styleCode,
        k.styleName,
        k.season,
        k.category,
        (k as any).vendor ?? "",
        +k.ros.toFixed(1),
        +k.inventoryCoverWeeks.toFixed(1),
        +k.grossMarginPct.toFixed(1),
        k.buyingScore,
        rebuyQty,
        getAction(k),
      ];
    });
  const header = [
    "Style Code",
    "Style Name",
    "Season",
    "Category",
    "Vendor",
    "ROS",
    "Inv Cover (wks)",
    "GM%",
    "Buying Score",
    "Rebuy Qty",
    "Action",
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([header, ...rows]),
    "Re-buy Planning",
  );
  XLSX.writeFile(wb, "rebuy-planning.xlsx");
}

function exportMarkdown(data: KPIResult[]) {
  type MdRow = KPIResult & { mdPct: number; mdRisk: string };
  const map = new Map<string, MdRow>();
  for (const k of data) {
    let mdPct = 0;
    let mdRisk = "None";
    if (k.ros < 4 && k.inventoryCoverWeeks > 12) {
      mdPct = 30;
      mdRisk = "High";
    } else if (k.ros < 7 && k.inventoryCoverWeeks > 8) {
      mdPct = 15;
      mdRisk = "Medium";
    }
    if (mdPct === 0) continue;
    const existing = map.get(k.styleCode);
    if (!existing || k.inventoryCoverWeeks > existing.inventoryCoverWeeks)
      map.set(k.styleCode, { ...k, mdPct, mdRisk });
  }
  const rows = Array.from(map.values()).map((k) => {
    const isUrgent = k.mdRisk === "High" && k.mdPct === 30;
    return [
      isUrgent ? "Urgent" : "Monitor",
      k.styleCode,
      k.styleName,
      k.season,
      k.category,
      +k.ros.toFixed(1),
      +k.inventoryCoverWeeks.toFixed(1),
      k.mdRisk,
      k.mdPct,
    ];
  });
  const header = [
    "Priority",
    "Style Code",
    "Style Name",
    "Season",
    "Category",
    "ROS",
    "Inv Cover (wks)",
    "Risk",
    "Markdown %",
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([header, ...rows]),
    "Markdown",
  );
  XLSX.writeFile(wb, "markdown-report.xlsx");
}

function exportSalesAnalysis(data: KPIResult[]) {
  const rows = data.map((k) => {
    const zoneAvg = getZoneAvgRos(k, data);
    const perfIdx = zoneAvg > 0 ? +(k.ros / zoneAvg).toFixed(2) : 1;
    const perfLabel =
      perfIdx > 1.2
        ? "High Performer"
        : perfIdx >= 0.8
          ? "Stable"
          : "Low Performer";
    const cover = k.inventoryCoverWeeks;
    return [
      k.styleCode,
      k.styleName,
      k.season,
      k.category,
      (k as any).vendor ?? "",
      +k.ros.toFixed(1),
      +zoneAvg.toFixed(2),
      +cover.toFixed(1),
      +k.grossMarginPct.toFixed(1),
      k.buyingScore,
      k.classification,
      perfIdx,
      perfLabel,
      k.ros > zoneAvg * 1.1 ? "Triggered" : "Not Triggered",
      cover > 10 ? "Overstocked" : cover >= 5 ? "Balanced" : "Understocked",
      getAction(k),
      getMomentum(k),
      getHealthLabel(k),
      (() => {
        const p = (() => {
          if (k.ros < 2 && cover > 12) return 30;
          if (k.ros < 4 && cover > 8) return 15;
          if (k.ros < 4) return 10;
          return 0;
        })();
        return p > 0 ? `${p}%` : "—";
      })(),
      getSmartRecommendation(k, data),
    ];
  });
  const header = [
    "Style Code",
    "Style Name",
    "Season",
    "Category",
    "Vendor",
    "ROS",
    "Zone Avg ROS",
    "Inv Cover (wks)",
    "GM%",
    "Buying Score",
    "Classification",
    "Performance Index",
    "Perf Label",
    "Rebuy Trigger",
    "Stock Status",
    "Action",
    "Momentum",
    "Health Label",
    "Markdown %",
    "Recommendation",
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([header, ...rows]),
    "Sales Analysis",
  );
  XLSX.writeFile(wb, "sales-analysis.xlsx");
}

// ── Sub-tables ───────────────────────────────────────────────────────────────
function RebuyPlanningTable({ data }: { data: KPIResult[] }) {
  const rebuyStyles = data.filter(
    (k) => k.classification === "Re-buy Candidate",
  );
  if (rebuyStyles.length === 0)
    return (
      <div className="py-10 text-center text-sm" style={{ color: "#94a3b8" }}>
        No re-buy candidates in current filters.
      </div>
    );
  return (
    <Table>
      <TableHeader>
        <TableRow style={{ background: "#f8fafc" }}>
          {[
            "Style Code",
            "Style Name",
            "Season",
            "Category",
            "Vendor",
            "ROS",
            "Inv Cover (wks)",
            "GM%",
            "Score",
            "Rebuy Qty",
            "Action",
          ].map((h) => (
            <TableHead
              key={h}
              className="text-xs font-semibold"
              style={{ color: "#64748b" }}
            >
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rebuyStyles.map((k, idx) => {
          const rebuyQty =
            Math.round(k.ros * 4 * (k.buyingScore / 100) * 10) * 10;
          const action = getAction(k);
          return (
            <TableRow
              key={k.styleCode}
              style={{ background: idx % 2 === 1 ? "#f8fafc" : "white" }}
            >
              <TableCell
                className="text-xs font-mono font-medium"
                style={{ color: "#b45309" }}
              >
                {k.styleCode}
              </TableCell>
              <TableCell
                className="text-xs font-medium"
                style={{ color: "#0f172a" }}
              >
                {k.styleName}
              </TableCell>
              <TableCell className="text-xs" style={{ color: "#64748b" }}>
                {k.season}
              </TableCell>
              <TableCell className="text-xs" style={{ color: "#64748b" }}>
                {k.category}
              </TableCell>
              <TableCell className="text-xs" style={{ color: "#64748b" }}>
                {(k as any).vendor ?? "—"}
              </TableCell>
              <TableCell
                className="text-xs font-semibold"
                style={{ color: "#0f172a" }}
              >
                {k.ros.toFixed(1)}
              </TableCell>
              <TableCell
                className="text-xs"
                style={{
                  color: k.inventoryCoverWeeks <= 3 ? "#dc2626" : "#64748b",
                }}
              >
                {k.inventoryCoverWeeks.toFixed(1)} wks
              </TableCell>
              <TableCell className="text-xs" style={{ color: "#0f172a" }}>
                {k.grossMarginPct.toFixed(1)}%
              </TableCell>
              <TableCell
                className="text-xs font-bold"
                style={{ color: "#0f172a" }}
              >
                {k.buyingScore}
              </TableCell>
              <TableCell
                className="text-xs font-semibold"
                style={{ color: "#16a34a" }}
              >
                {rebuyQty.toLocaleString()}
              </TableCell>
              <TableCell>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background:
                      action === "Rebuy"
                        ? "#dcfce7"
                        : action === "Exit"
                          ? "#fee2e2"
                          : action === "Markdown"
                            ? "#fef9c3"
                            : "#e0e7ff",
                    color:
                      action === "Rebuy"
                        ? "#15803d"
                        : action === "Exit"
                          ? "#dc2626"
                          : action === "Markdown"
                            ? "#b45309"
                            : "#4338ca",
                  }}
                >
                  {action}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function MarkdownTable({ data }: { data: KPIResult[] }) {
  const map = new Map<string, KPIResult & { mdPct: number; mdRisk: string }>();
  for (const k of data) {
    let mdPct = 0;
    let mdRisk = "None";
    if (k.ros < 4 && k.inventoryCoverWeeks > 12) {
      mdPct = 30;
      mdRisk = "High";
    } else if (k.ros < 7 && k.inventoryCoverWeeks > 8) {
      mdPct = 15;
      mdRisk = "Medium";
    }
    if (mdPct === 0) continue;
    const existing = map.get(k.styleCode);
    if (!existing || k.inventoryCoverWeeks > existing.inventoryCoverWeeks)
      map.set(k.styleCode, { ...k, mdPct, mdRisk });
  }
  const mdStyles = Array.from(map.values());
  if (mdStyles.length === 0)
    return (
      <div className="py-10 text-center text-sm" style={{ color: "#94a3b8" }}>
        No styles flagged for markdown.
      </div>
    );
  return (
    <Table>
      <TableHeader>
        <TableRow style={{ background: "#f8fafc" }}>
          {[
            "Priority",
            "Style Code",
            "Style Name",
            "Category",
            "ROS",
            "Stock Cover (wks)",
            "Risk",
            "Markdown %",
          ].map((h) => (
            <TableHead
              key={h}
              className="text-xs font-semibold"
              style={{ color: "#64748b" }}
            >
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {mdStyles.map((k, idx) => {
          const isUrgent = k.mdRisk === "High" && k.mdPct === 30;
          return (
            <TableRow
              key={k.styleCode}
              style={{ background: idx % 2 === 1 ? "#f8fafc" : "white" }}
            >
              <TableCell>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{
                    background: isUrgent ? "#fee2e2" : "#fef3c7",
                    color: isUrgent ? "#b91c1c" : "#b45309",
                  }}
                >
                  {isUrgent ? "🔴 Urgent" : "🟡 Monitor"}
                </span>
              </TableCell>
              <TableCell
                className="text-xs font-mono font-medium"
                style={{ color: "#b45309" }}
              >
                {k.styleCode}
              </TableCell>
              <TableCell
                className="text-xs font-medium"
                style={{ color: "#0f172a" }}
              >
                {k.styleName}
              </TableCell>
              <TableCell className="text-xs" style={{ color: "#64748b" }}>
                {k.category}
              </TableCell>
              <TableCell
                className="text-xs font-semibold"
                style={{ color: "#0f172a" }}
              >
                {k.ros.toFixed(1)}
              </TableCell>
              <TableCell
                className="text-xs"
                style={{
                  color: k.inventoryCoverWeeks > 12 ? "#dc2626" : "#64748b",
                }}
              >
                {k.inventoryCoverWeeks.toFixed(1)} wks
              </TableCell>
              <TableCell>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: k.mdRisk === "High" ? "#fee2e2" : "#fef3c7",
                    color: k.mdRisk === "High" ? "#b91c1c" : "#b45309",
                  }}
                >
                  {k.mdRisk}
                </span>
              </TableCell>
              <TableCell>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: k.mdPct === 30 ? "#b91c1c" : "#d97706",
                    color: "white",
                  }}
                >
                  {k.mdPct}%
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function getMarkdownPct(k: KPIResult): number {
  if (k.ros < 2 && k.inventoryCoverWeeks > 12) return 30;
  if (k.ros < 4 && k.inventoryCoverWeeks > 8) return 15;
  if (k.ros < 4) return 10;
  return 0;
}

function SalesAnalysisTable({ data }: { data: KPIResult[] }) {
  if (data.length === 0)
    return (
      <div className="py-10 text-center text-sm" style={{ color: "#94a3b8" }}>
        No styles match current filters.
      </div>
    );
  return (
    <Table>
      <TableHeader>
        <TableRow style={{ background: "#f8fafc" }}>
          {[
            "Style Code",
            "Style Name",
            "Category",
            "ROS",
            "Zone Avg",
            "Cover (wks)",
            "Perf Index",
            "Trigger",
            "Stock Status",
            "Action",
            "Momentum",
            "Health",
            "Markdown %",
            "Recommendation",
          ].map((h) => (
            <TableHead
              key={h}
              className="text-xs font-semibold"
              style={{ color: "#64748b" }}
            >
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((k, idx) => {
          const zoneAvg = getZoneAvgRos(k, data);
          const perfIdx = zoneAvg > 0 ? +(k.ros / zoneAvg).toFixed(2) : 1;
          const perfLabel =
            perfIdx > 1.2
              ? "High Performer"
              : perfIdx >= 0.8
                ? "Stable"
                : "Low Performer";
          const trigger = k.ros > zoneAvg * 1.1 ? "Triggered" : "Not Triggered";
          const cover = k.inventoryCoverWeeks;
          const stockStatus =
            cover > 10
              ? "Overstocked"
              : cover >= 5
                ? "Balanced"
                : "Understocked";
          const action = getAction(k);
          const momentum = getMomentum(k);
          const health = getHealthLabel(k);
          return (
            <TableRow
              key={k.styleCode}
              style={{ background: idx % 2 === 1 ? "#f8fafc" : "white" }}
            >
              <TableCell
                className="text-xs font-mono font-medium"
                style={{ color: "#b45309" }}
              >
                {k.styleCode}
              </TableCell>
              <TableCell
                className="text-xs font-medium"
                style={{ color: "#0f172a" }}
              >
                {k.styleName}
              </TableCell>
              <TableCell className="text-xs" style={{ color: "#64748b" }}>
                {k.category}
              </TableCell>
              <TableCell
                className="text-xs font-semibold"
                style={{ color: "#0f172a" }}
              >
                {k.ros.toFixed(1)}
              </TableCell>
              <TableCell className="text-xs" style={{ color: "#64748b" }}>
                {zoneAvg.toFixed(2)}
              </TableCell>
              <TableCell
                className="text-xs"
                style={{ color: cover <= 3 ? "#dc2626" : "#64748b" }}
              >
                {cover.toFixed(1)} wks
              </TableCell>
              <TableCell>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background:
                      perfLabel === "High Performer"
                        ? "#dcfce7"
                        : perfLabel === "Stable"
                          ? "#e0e7ff"
                          : "#fee2e2",
                    color:
                      perfLabel === "High Performer"
                        ? "#15803d"
                        : perfLabel === "Stable"
                          ? "#4338ca"
                          : "#dc2626",
                  }}
                >
                  {perfLabel}
                </span>
              </TableCell>
              <TableCell>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: trigger === "Triggered" ? "#dcfce7" : "#f1f5f9",
                    color: trigger === "Triggered" ? "#15803d" : "#64748b",
                  }}
                >
                  {trigger}
                </span>
              </TableCell>
              <TableCell>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background:
                      stockStatus === "Understocked"
                        ? "#fee2e2"
                        : stockStatus === "Overstocked"
                          ? "#fef9c3"
                          : "#dcfce7",
                    color:
                      stockStatus === "Understocked"
                        ? "#dc2626"
                        : stockStatus === "Overstocked"
                          ? "#b45309"
                          : "#15803d",
                  }}
                >
                  {stockStatus}
                </span>
              </TableCell>
              <TableCell>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background:
                      action === "Rebuy"
                        ? "#dcfce7"
                        : action === "Exit"
                          ? "#fee2e2"
                          : action === "Markdown"
                            ? "#fef9c3"
                            : "#e0e7ff",
                    color:
                      action === "Rebuy"
                        ? "#15803d"
                        : action === "Exit"
                          ? "#dc2626"
                          : action === "Markdown"
                            ? "#b45309"
                            : "#4338ca",
                  }}
                >
                  {action}
                </span>
              </TableCell>
              <TableCell>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background:
                      momentum === "Increasing"
                        ? "#dcfce7"
                        : momentum === "Declining"
                          ? "#fee2e2"
                          : "#f1f5f9",
                    color:
                      momentum === "Increasing"
                        ? "#15803d"
                        : momentum === "Declining"
                          ? "#dc2626"
                          : "#64748b",
                  }}
                >
                  {momentum}
                </span>
              </TableCell>
              <TableCell>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background:
                      health === "Healthy"
                        ? "#dcfce7"
                        : health === "Poor"
                          ? "#fee2e2"
                          : "#fef9c3",
                    color:
                      health === "Healthy"
                        ? "#15803d"
                        : health === "Poor"
                          ? "#dc2626"
                          : "#b45309",
                  }}
                >
                  {health}
                </span>
              </TableCell>
              <TableCell
                className="text-xs font-semibold"
                style={{ color: getMarkdownPct(k) > 0 ? "#b91c1c" : "#94a3b8" }}
              >
                {getMarkdownPct(k) > 0 ? `${getMarkdownPct(k)}%` : "—"}
              </TableCell>
              <TableCell className="min-w-[200px]">
                <p className="text-xs italic" style={{ color: "#64748b" }}>
                  {getSmartRecommendation(k, data)}
                </p>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ── Report config ────────────────────────────────────────────────────────────
type ActiveReport = "rebuy-planning" | "sales-analysis" | "markdown";

const REPORT_CONFIG: Record<
  ActiveReport,
  { title: string; subtitle: (rebuyCount: number) => string }
> = {
  "rebuy-planning": {
    title: "Re-buy Planning",
    subtitle: (rebuyCount) => `${rebuyCount} styles recommended for re-buy`,
  },
  "sales-analysis": {
    title: "Sales Analysis",
    subtitle: () => "Full intelligence view across all styles",
  },
  markdown: {
    title: "Markdown Report",
    subtitle: () => "Styles flagged for discount action",
  },
};

// ── Main component ───────────────────────────────────────────────────────────
export function Reports() {
  const { filteredKPIs } = useData();
  const [activeReport, setActiveReport] =
    useState<ActiveReport>("rebuy-planning");

  const total = filteredKPIs.length;
  const rebuyCount = filteredKPIs.filter(
    (k) => k.classification === "Re-buy Candidate",
  ).length;
  const avgScore =
    total > 0
      ? Math.round(filteredKPIs.reduce((s, k) => s + k.buyingScore, 0) / total)
      : 0;
  const avgGM =
    total > 0
      ? (
          filteredKPIs.reduce((s, k) => s + k.grossMarginPct, 0) / total
        ).toFixed(1)
      : "0.0";

  const config = REPORT_CONFIG[activeReport];

  function handleDownload() {
    if (activeReport === "rebuy-planning") exportRebuyPlanning(filteredKPIs);
    else if (activeReport === "sales-analysis")
      exportSalesAnalysis(filteredKPIs);
    else exportMarkdown(filteredKPIs);
  }

  return (
    <Layout title="Reports & Data Export">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Styles", value: total, color: "#4f46e5" },
          { label: "Re-buy Candidates", value: rebuyCount, color: "#16a34a" },
          { label: "Avg Buying Score", value: avgScore, color: "#0891b2" },
          { label: "Avg Gross Margin", value: `${avgGM}%`, color: "#d97706" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className="shadow-card border-0">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs" style={{ color: "#64748b" }}>
                  {s.label}
                </p>
                <p
                  className="text-2xl font-bold mt-1"
                  style={{ color: s.color }}
                >
                  {s.value}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Single report card — title & content change with active selection ── */}
      <motion.div
        key={activeReport}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="mb-6"
      >
        <Card className="shadow-card border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle
                  className="text-base font-semibold"
                  style={{ color: "#0f172a" }}
                >
                  {config.title}
                </CardTitle>
                <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                  {config.subtitle(rebuyCount)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Switch report dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 font-medium"
                      style={{ borderColor: "#d97706", color: "#d97706" }}
                      data-ocid="reports.switch_report.dropdown_trigger"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Switch Report
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {[
                      {
                        id: "rebuy-planning" as ActiveReport,
                        label: "Re-buy Planning",
                      },
                      {
                        id: "sales-analysis" as ActiveReport,
                        label: "Sales Analysis",
                      },
                      {
                        id: "markdown" as ActiveReport,
                        label: "Markdown Report",
                      },
                    ].map((opt) => (
                      <DropdownMenuItem
                        key={opt.id}
                        className="text-sm gap-2 cursor-pointer"
                        onClick={() => setActiveReport(opt.id)}
                        data-ocid={`reports.switch.${opt.id}`}
                      >
                        <Check
                          className="w-4 h-4"
                          style={{
                            opacity: activeReport === opt.id ? 1 : 0,
                            color: "#d97706",
                          }}
                        />
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Download active report */}
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  style={{ background: "#d97706", color: "white" }}
                  onClick={handleDownload}
                  data-ocid="reports.active.download"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {activeReport === "rebuy-planning" && (
              <RebuyPlanningTable data={filteredKPIs} />
            )}
            {activeReport === "sales-analysis" && (
              <SalesAnalysisTable data={filteredKPIs} />
            )}
            {activeReport === "markdown" && (
              <MarkdownTable data={filteredKPIs} />
            )}
          </CardContent>
        </Card>
      </motion.div>
    </Layout>
  );
}
