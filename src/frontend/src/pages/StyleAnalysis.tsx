import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Layout } from "../components/Layout";
import { useData } from "../context/DataContext";
import type { KPIResult } from "../types/index";

// ── Derived metric helpers ──────────────────────────────────────────────────

function getZoneAvgRos(k: KPIResult, allKPIs: KPIResult[]): number {
  const zoneItems = allKPIs.filter((x) => x.category === k.category);
  if (!zoneItems.length) return k.ros || 1;
  const avg = zoneItems.reduce((s, x) => s + x.ros, 0) / zoneItems.length;
  return avg || 1;
}

type PerfLabel = "High Performer" | "Stable" | "Low Performer";
function getPerfIndex(
  k: KPIResult,
  allKPIs: KPIResult[],
): { index: number; label: PerfLabel } {
  const zoneAvg = getZoneAvgRos(k, allKPIs);
  const index = zoneAvg > 0 ? +(k.ros / zoneAvg).toFixed(2) : 1;
  const label: PerfLabel =
    index > 1.2 ? "High Performer" : index >= 0.8 ? "Stable" : "Low Performer";
  return { index, label };
}

function getRebuytrigger(
  k: KPIResult,
  allKPIs: KPIResult[],
): "Triggered" | "Not Triggered" {
  const zoneAvg = getZoneAvgRos(k, allKPIs);
  return k.ros > zoneAvg * 1.1 ? "Triggered" : "Not Triggered";
}

type StockStatus = "Overstocked" | "Balanced" | "Understocked";
function getStockStatus(k: KPIResult): StockStatus {
  if (k.inventoryCoverWeeks > 10) return "Overstocked";
  if (k.inventoryCoverWeeks >= 5) return "Balanced";
  return "Understocked";
}

type ActionType = "Rebuy" | "Hold" | "Exit" | "Markdown";
function getAction(k: KPIResult): ActionType {
  if (k.inventoryCoverWeeks > 10 && k.ros < 4) return "Markdown";
  if (k.classification === "Re-buy Candidate") return "Rebuy";
  if (k.classification === "Do Not Re-buy") return "Exit";
  return "Hold";
}

type Momentum = "Increasing" | "Stable" | "Declining";
function getMomentum(k: KPIResult): Momentum {
  if (k.ros >= 8 && k.inventoryCoverWeeks < 5) return "Increasing";
  if (k.ros >= 4) return "Stable";
  return "Declining";
}

type HealthLabel = "Healthy" | "Medium" | "Poor";
function getHealthScore(k: KPIResult): { score: number; label: HealthLabel } {
  const cover = Math.max(0.1, k.inventoryCoverWeeks);
  const sellThrough = Math.min(1, 8 / (8 + cover));
  const score = +(sellThrough * 0.6 + (1 / cover) * 0.4).toFixed(3);
  const label: HealthLabel =
    score >= 0.7 ? "Healthy" : score >= 0.4 ? "Medium" : "Poor";
  return { score, label };
}

function getMarkdownPct(k: KPIResult): number {
  if (k.ros < 2 && k.inventoryCoverWeeks > 12) return 30;
  if (k.ros < 4 && k.inventoryCoverWeeks > 8) return 15;
  if (k.ros < 4) return 10;
  return 0;
}

function getSmartRecommendation(k: KPIResult, allKPIs: KPIResult[]): string {
  const { label: perfLabel } = getPerfIndex(k, allKPIs);
  const stock = getStockStatus(k);
  const action = getAction(k);
  if (perfLabel === "High Performer" && stock === "Understocked")
    return "Strong performer with low cover — immediate replenishment required.";
  if (perfLabel === "Low Performer" && stock === "Overstocked")
    return "Slow moving with high stock — initiate markdown.";
  if (perfLabel === "Stable" && action === "Rebuy")
    return "Stable performance — controlled rebuy recommended.";
  if (action === "Exit")
    return "Weak velocity — recommend exit. Avoid further commitment.";
  if (stock === "Overstocked")
    return "High stock cover — monitor closely before any rebuy.";
  if (perfLabel === "High Performer")
    return "High performer — maintain supply to avoid stockout.";
  return "Average performer — review trend before placing order.";
}

// ── Badge components ────────────────────────────────────────────────────────

function PerfBadge({ label }: { label: PerfLabel }) {
  const cfg = {
    "High Performer": { bg: "#dcfce7", text: "#15803d" },
    Stable: { bg: "#fef3c7", text: "#b45309" },
    "Low Performer": { bg: "#fee2e2", text: "#b91c1c" },
  }[label];
  return (
    <Badge
      className="text-xs font-medium whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.text, border: "none" }}
    >
      {label}
    </Badge>
  );
}

function TriggerBadge({ value }: { value: "Triggered" | "Not Triggered" }) {
  return (
    <Badge
      className="text-xs font-medium whitespace-nowrap"
      style={{
        background: value === "Triggered" ? "#dcfce7" : "#f1f5f9",
        color: value === "Triggered" ? "#15803d" : "#64748b",
        border: "none",
      }}
    >
      {value}
    </Badge>
  );
}

function StockBadge({ value }: { value: StockStatus }) {
  const cfg = {
    Overstocked: { bg: "#fee2e2", text: "#b91c1c" },
    Balanced: { bg: "#dcfce7", text: "#15803d" },
    Understocked: { bg: "#fef3c7", text: "#b45309" },
  }[value];
  return (
    <Badge
      className="text-xs font-medium whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.text, border: "none" }}
    >
      {value}
    </Badge>
  );
}

function ActionBadge({ value }: { value: ActionType }) {
  const cfg = {
    Rebuy: { bg: "#dcfce7", text: "#15803d" },
    Hold: { bg: "#e0f2fe", text: "#0369a1" },
    Exit: { bg: "#fee2e2", text: "#b91c1c" },
    Markdown: { bg: "#fef3c7", text: "#b45309" },
  }[value];
  return (
    <Badge
      className="text-xs font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.text, border: "none" }}
    >
      {value}
    </Badge>
  );
}

function MomentumBadge({ value }: { value: Momentum }) {
  const cfg = {
    Increasing: { bg: "#dcfce7", text: "#15803d", icon: "↑" },
    Stable: { bg: "#fef3c7", text: "#b45309", icon: "→" },
    Declining: { bg: "#fee2e2", text: "#b91c1c", icon: "↓" },
  }[value];
  return (
    <Badge
      className="text-xs font-medium whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.text, border: "none" }}
    >
      {cfg.icon} {value}
    </Badge>
  );
}

function HealthBadge({ label }: { label: HealthLabel }) {
  const cfg = {
    Healthy: { bg: "#dcfce7", text: "#15803d" },
    Medium: { bg: "#fef3c7", text: "#b45309" },
    Poor: { bg: "#fee2e2", text: "#b91c1c" },
  }[label];
  return (
    <Badge
      className="text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.text, border: "none" }}
    >
      {label}
    </Badge>
  );
}

// ── Chart colours ───────────────────────────────────────────────────────────
const BUCKET_COLORS: Record<string, string> = {
  "0–20": "#dc2626",
  "21–40": "#f97316",
  "41–60": "#d97706",
  "61–80": "#84cc16",
  "81–100": "#16a34a",
};
const SCORE_BUCKETS = [
  { label: "0–20", min: 0, max: 20 },
  { label: "21–40", min: 21, max: 40 },
  { label: "41–60", min: 41, max: 60 },
  { label: "61–80", min: 61, max: 80 },
  { label: "81–100", min: 81, max: 100 },
];

// ── Main page ────────────────────────────────────────────────────────────────
export function StyleAnalysis() {
  const { filteredKPIs } = useData();
  const [actionFilter, setActionFilter] = useState("all");
  const [perfFilter, setPerfFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Category performance data
  const categoryData = useMemo(() => {
    const cats = Array.from(new Set(filteredKPIs.map((k) => k.category)));
    return cats
      .map((cat) => {
        const items = filteredKPIs.filter((k) => k.category === cat);
        const avgScore = items.length
          ? Math.round(
              items.reduce((s, k) => s + k.buyingScore, 0) / items.length,
            )
          : 0;
        const rebuyPct = items.length
          ? Math.round(
              (items.filter((k) => k.classification === "Re-buy Candidate")
                .length /
                items.length) *
                100,
            )
          : 0;
        return { cat, avgScore, rebuyPct, count: items.length };
      })
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [filteredKPIs]);

  // Score distribution
  const scoreDistribution = useMemo(() => {
    return SCORE_BUCKETS.map((bucket) => ({
      label: bucket.label,
      count: filteredKPIs.filter(
        (k) => k.buyingScore >= bucket.min && k.buyingScore <= bucket.max,
      ).length,
    }));
  }, [filteredKPIs]);

  // Enriched rows for the table
  const displayed = useMemo(() => {
    return filteredKPIs
      .filter((k) => {
        if (actionFilter !== "all" && getAction(k) !== actionFilter)
          return false;
        if (
          perfFilter !== "all" &&
          getPerfIndex(k, filteredKPIs).label !== perfFilter
        )
          return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !k.styleCode.toLowerCase().includes(q) &&
            !k.styleName.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => b.buyingScore - a.buyingScore);
  }, [filteredKPIs, actionFilter, perfFilter, search]);

  return (
    <Layout title="Style Analysis – Decision Intelligence">
      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="shadow-card border-0 h-full">
            <CardHeader className="pb-2">
              <CardTitle
                className="text-sm font-semibold"
                style={{ color: "#0f172a" }}
              >
                Performance by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categoryData} barSize={32} layout="vertical">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      dataKey="cat"
                      type="category"
                      width={72}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(val: number) => [`${val}`, "Avg Score"]}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <Bar dataKey="avgScore" radius={[0, 4, 4, 0]}>
                      {categoryData.map((d) => (
                        <Cell
                          key={d.cat}
                          fill={
                            d.avgScore >= 70
                              ? "#16a34a"
                              : d.avgScore >= 50
                                ? "#d97706"
                                : "#dc2626"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div
                  className="flex items-center justify-center h-48 text-sm"
                  style={{ color: "#94a3b8" }}
                >
                  No data
                </div>
              )}
              <div className="mt-2 grid grid-cols-3 gap-2">
                {categoryData.map((d) => (
                  <div
                    key={d.cat}
                    className="rounded-lg px-2 py-1.5"
                    style={{ background: "#f8fafc" }}
                  >
                    <p
                      className="text-xs font-semibold truncate"
                      style={{ color: "#0f172a" }}
                    >
                      {d.cat}
                    </p>
                    <p className="text-xs" style={{ color: "#64748b" }}>
                      {d.count} styles · {d.rebuyPct}% re-buy
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="shadow-card border-0 h-full">
            <CardHeader className="pb-2">
              <CardTitle
                className="text-sm font-semibold"
                style={{ color: "#0f172a" }}
              >
                Buying Score Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={scoreDistribution} barSize={40}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(val: number) => [`${val} styles`, "Count"]}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {scoreDistribution.map((d) => (
                      <Cell
                        key={d.label}
                        fill={BUCKET_COLORS[d.label] ?? "#94a3b8"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div
                className="mt-2 flex items-center gap-3 flex-wrap text-xs"
                style={{ color: "#64748b" }}
              >
                {SCORE_BUCKETS.map((b) => (
                  <span key={b.label} className="flex items-center gap-1">
                    <span
                      className="w-2.5 h-2.5 rounded-sm inline-block"
                      style={{ background: BUCKET_COLORS[b.label] }}
                    />
                    {b.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detail Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
      >
        <Card className="shadow-card border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle
                  className="text-sm font-semibold"
                  style={{ color: "#0f172a" }}
                >
                  Style-Level Decision Intelligence
                </CardTitle>
                <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                  {displayed.length} of {filteredKPIs.length} styles shown
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                    style={{ color: "#94a3b8" }}
                  />
                  <Input
                    placeholder="Search style..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs w-44"
                  />
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="Rebuy">Rebuy</SelectItem>
                    <SelectItem value="Hold">Hold</SelectItem>
                    <SelectItem value="Exit">Exit</SelectItem>
                    <SelectItem value="Markdown">Markdown</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={perfFilter} onValueChange={setPerfFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="Performance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Performers</SelectItem>
                    <SelectItem value="High Performer">
                      High Performer
                    </SelectItem>
                    <SelectItem value="Stable">Stable</SelectItem>
                    <SelectItem value="Low Performer">Low Performer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {displayed.length === 0 ? (
              <div
                className="py-12 text-center text-sm"
                style={{ color: "#94a3b8" }}
              >
                No styles match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow style={{ background: "#f8fafc" }}>
                      {[
                        "Style",
                        "Perf. Index",
                        "Rebuy Trigger",
                        "Stock Status",
                        "Momentum",
                        "Action",
                        "Inv. Health",
                        "Markdown",
                        "Recommendation",
                      ].map((h) => (
                        <TableHead
                          key={h}
                          className="text-xs font-semibold whitespace-nowrap"
                          style={{ color: "#64748b" }}
                        >
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayed.map((k, idx) => {
                      const { index: perfIdx, label: perfLabel } = getPerfIndex(
                        k,
                        filteredKPIs,
                      );
                      const trigger = getRebuytrigger(k, filteredKPIs);
                      const stockStatus = getStockStatus(k);
                      const momentum = getMomentum(k);
                      const action = getAction(k);
                      const { label: healthLabel } = getHealthScore(k);
                      const markdownPct = getMarkdownPct(k);
                      const recommendation = getSmartRecommendation(
                        k,
                        filteredKPIs,
                      );
                      return (
                        <TableRow
                          key={`${k.styleCode}-${k.season}-${idx}`}
                          style={{
                            background: idx % 2 === 1 ? "#f8fafc" : "white",
                          }}
                        >
                          <TableCell className="min-w-[140px]">
                            <p
                              className="text-xs font-mono font-bold"
                              style={{ color: "#b45309" }}
                            >
                              {k.styleCode}
                            </p>
                            <p
                              className="text-xs truncate max-w-[120px]"
                              style={{ color: "#64748b" }}
                            >
                              {k.styleName}
                            </p>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                              style={{
                                background: "#fef3c7",
                                color: "#92400e",
                              }}
                            >
                              {k.category}
                            </span>
                          </TableCell>
                          <TableCell className="min-w-[120px]">
                            <PerfBadge label={perfLabel} />
                            <p
                              className="text-xs mt-1"
                              style={{ color: "#94a3b8" }}
                            >
                              Index: {perfIdx}×
                            </p>
                          </TableCell>
                          <TableCell>
                            <TriggerBadge value={trigger} />
                          </TableCell>
                          <TableCell>
                            <StockBadge value={stockStatus} />
                            <p
                              className="text-xs mt-1"
                              style={{ color: "#94a3b8" }}
                            >
                              {k.inventoryCoverWeeks.toFixed(1)} wks
                            </p>
                          </TableCell>
                          <TableCell>
                            <MomentumBadge value={momentum} />
                          </TableCell>
                          <TableCell>
                            <ActionBadge value={action} />
                          </TableCell>
                          <TableCell>
                            <HealthBadge label={healthLabel} />
                          </TableCell>
                          <TableCell
                            className="text-xs font-semibold"
                            style={{
                              color: markdownPct > 0 ? "#b91c1c" : "#94a3b8",
                            }}
                          >
                            {markdownPct > 0 ? `${markdownPct}%` : "—"}
                          </TableCell>
                          <TableCell className="min-w-[200px]">
                            <p
                              className="text-xs italic"
                              style={{ color: "#64748b" }}
                            >
                              {recommendation}
                            </p>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </Layout>
  );
}
