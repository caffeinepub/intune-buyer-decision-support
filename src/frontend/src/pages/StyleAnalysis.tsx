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
import {
  BarChart2,
  ImageIcon,
  Package,
  Search,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { useData } from "../context/DataContext";
import type { KPIResult } from "../types/index";

// ── Derived metric helpers ─────────────────────────────────────────────

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
  const categoryAvg = getZoneAvgRos(k, allKPIs);
  const ros4w = k.ros4Week ?? k.ros;
  const index = categoryAvg > 0 ? +(ros4w / categoryAvg).toFixed(2) : 1;
  const label: PerfLabel =
    index > 1.2 ? "High Performer" : index >= 1.0 ? "Stable" : "Low Performer";
  return { index, label };
}

function getRebuytrigger(k: KPIResult): "Triggered" | "Not Triggered" {
  return k.classification === "Re-buy Candidate"
    ? "Triggered"
    : "Not Triggered";
}

type StockStatus = "Overstocked" | "Balanced" | "Understocked";
function getStockStatus(k: KPIResult): StockStatus {
  if (k.classification === "Re-buy Candidate") return "Understocked";
  if (k.inventoryCoverWeeks > 12) return "Overstocked";
  return "Balanced";
}

type ActionType = "Rebuy" | "Hold" | "Exit" | "Markdown";
function getAction(k: KPIResult): ActionType {
  if (k.inventoryCoverWeeks > 10 && k.ros < 4) return "Markdown";
  if (k.classification === "Re-buy Candidate") return "Rebuy";
  if (k.classification === "Do Not Re-buy") return "Exit";
  return "Hold";
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

// ── Badge components ──────────────────────────────────────────────────

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

// ── Style Card ───────────────────────────────────────────────────────────

function StyleCard({
  kpi,
  allKPIs,
  imageUrl,
  zone,
}: {
  kpi: KPIResult;
  allKPIs: KPIResult[];
  imageUrl: string | undefined;
  zone: string;
}) {
  const ros4w = kpi.ros4Week ?? kpi.ros;
  const categoryAvg = getZoneAvgRos(kpi, allKPIs);
  const { label: perfLabel } = getPerfIndex(kpi, allKPIs);
  const trigger = getRebuytrigger(kpi);
  const stockStatus = getStockStatus(kpi);
  const action = getAction(kpi);
  const { label: healthLabel } = getHealthScore(kpi);
  const recommendation = getSmartRecommendation(kpi, allKPIs);

  return (
    <Card className="shadow-card border-0 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row gap-0">
          {/* Image Panel */}
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: "100%",
              maxWidth: "260px",
              minHeight: "320px",
              background: "linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)",
              borderRight: "1px solid #e2e8f0",
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={kpi.styleCode}
                className="object-contain"
                style={{
                  maxWidth: "220px",
                  maxHeight: "300px",
                  width: "100%",
                  height: "auto",
                  display: "block",
                  padding: "12px",
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const parent = (e.currentTarget as HTMLImageElement)
                    .parentElement;
                  if (parent) {
                    parent.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;color:#cbd5e1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      <span style="font-size:12px;color:#94a3b8">No image</span>
                    </div>`;
                  }
                }}
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center gap-3"
                style={{ color: "#cbd5e1" }}
              >
                <ImageIcon className="w-12 h-12" />
                <p
                  className="text-xs text-center px-4"
                  style={{ color: "#94a3b8" }}
                >
                  Upload VM Deck to see style photo
                </p>
              </div>
            )}
          </div>

          {/* Info Panel */}
          <div className="flex-1 p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p
                  className="text-xs font-mono font-bold mb-1"
                  style={{ color: "#b45309" }}
                >
                  {kpi.styleCode}
                </p>
                <h2
                  className="text-xl font-bold leading-tight"
                  style={{ color: "#0f172a" }}
                >
                  {kpi.styleName}
                </h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "#fef3c7", color: "#92400e" }}
                  >
                    {kpi.category}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "#ede9fe", color: "#5b21b6" }}
                  >
                    Zone: {zone}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "#f0fdf4", color: "#166534" }}
                  >
                    {kpi.season}
                  </span>
                </div>
              </div>
              <ActionBadge value={action} />
            </div>

            {/* 4 KPI stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {/* ROS */}
              <div className="rounded-xl p-3" style={{ background: "#f8fafc" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp
                    className="w-3.5 h-3.5"
                    style={{ color: "#d97706" }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#64748b" }}
                  >
                    4W ROS
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "#0f172a" }}>
                  {ros4w.toFixed(1)}
                  <span
                    className="text-sm font-normal ml-1"
                    style={{ color: "#94a3b8" }}
                  >
                    /wk
                  </span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                  Cat avg: {categoryAvg.toFixed(1)}
                </p>
              </div>

              {/* Zone */}
              <div className="rounded-xl p-3" style={{ background: "#f8fafc" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart2
                    className="w-3.5 h-3.5"
                    style={{ color: "#7c3aed" }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#64748b" }}
                  >
                    Zone
                  </span>
                </div>
                <p className="text-lg font-bold" style={{ color: "#0f172a" }}>
                  {zone}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                  VM placement
                </p>
              </div>

              {/* Sell-Through */}
              <div className="rounded-xl p-3" style={{ background: "#f8fafc" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <ShoppingBag
                    className="w-3.5 h-3.5"
                    style={{ color: "#0369a1" }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#64748b" }}
                  >
                    Sell-Through
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "#0f172a" }}>
                  {kpi.sellThroughPct}%
                </p>
                <div
                  className="w-full h-1.5 rounded-full mt-1 overflow-hidden"
                  style={{ background: "#e2e8f0" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, kpi.sellThroughPct)}%`,
                      background:
                        kpi.sellThroughPct >= 70
                          ? "#16a34a"
                          : kpi.sellThroughPct >= 40
                            ? "#d97706"
                            : "#dc2626",
                    }}
                  />
                </div>
              </div>

              {/* Sales */}
              <div className="rounded-xl p-3" style={{ background: "#f8fafc" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Package
                    className="w-3.5 h-3.5"
                    style={{ color: "#0f172a" }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#64748b" }}
                  >
                    Sales
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "#0f172a" }}>
                  {kpi.totalSalesUnits.toLocaleString()}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                  units sold
                </p>
              </div>
            </div>

            {/* Analytics badges */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: "#94a3b8" }}>
                  Perf. Index
                </span>
                <PerfBadge label={perfLabel} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: "#94a3b8" }}>
                  Rebuy Trigger
                </span>
                <TriggerBadge value={trigger} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: "#94a3b8" }}>
                  Stock Status
                </span>
                <div className="flex items-center gap-1">
                  <StockBadge value={stockStatus} />
                  <span className="text-xs" style={{ color: "#94a3b8" }}>
                    {kpi.inventoryCoverWeeks.toFixed(1)} wks
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: "#94a3b8" }}>
                  Inv. Health
                </span>
                <HealthBadge label={healthLabel} />
              </div>
              {kpi.vendor && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs" style={{ color: "#94a3b8" }}>
                    Vendor
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#475569" }}
                  >
                    {kpi.vendor}
                  </span>
                </div>
              )}
            </div>

            {/* Recommendation */}
            <div
              className="rounded-xl px-4 py-3 text-sm italic"
              style={{
                background: "#fefce8",
                color: "#92400e",
                borderLeft: "3px solid #d97706",
              }}
            >
              {recommendation}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Style photo thumbnail (for table rows) ──────────────────────────────────────
function StylePhoto({
  imageUrl,
  styleCode,
}: { imageUrl?: string; styleCode: string }) {
  if (!imageUrl) {
    return (
      <div
        className="w-14 h-16 rounded-lg flex flex-col items-center justify-center gap-1"
        style={{ background: "#f1f5f9" }}
      >
        <ImageIcon className="w-5 h-5" style={{ color: "#cbd5e1" }} />
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={styleCode}
      className="w-14 h-16 rounded-lg object-cover"
      style={{ border: "1px solid #e2e8f0" }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function StyleAnalysis() {
  const { filteredKPIs, vmDeckData } = useData();
  const [actionFilter, setActionFilter] = useState("all");
  const [perfFilter, setPerfFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedStyleCode, setSelectedStyleCode] =
    useState<string>("__first__");

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

  // Resolve which style is selected for the card view
  const selectedKPI = useMemo(() => {
    if (displayed.length === 0) return null;
    if (selectedStyleCode === "__first__") return displayed[0];
    const found = displayed.find((k) => k.styleCode === selectedStyleCode);
    return found ?? displayed[0];
  }, [displayed, selectedStyleCode]);

  const selectedVMEntry = selectedKPI
    ? vmDeckData[selectedKPI.styleCode]
    : undefined;

  return (
    <Layout title="Style Analysis – Decision Intelligence">
      {/* Style Selector + Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
        className="mb-4"
      >
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p
                  className="text-xs font-medium mb-1 block"
                  style={{ color: "#64748b" }}
                >
                  Select Style
                </p>
                <Select
                  value={
                    selectedStyleCode === "__first__"
                      ? (displayed[0]?.styleCode ?? "__first__")
                      : selectedStyleCode
                  }
                  onValueChange={(v) => setSelectedStyleCode(v)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select a style..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {displayed.map((k) => (
                      <SelectItem key={k.styleCode} value={k.styleCode}>
                        <span
                          className="font-mono font-semibold mr-2"
                          style={{ color: "#b45309" }}
                        >
                          {k.styleCode}
                        </span>
                        <span style={{ color: "#64748b" }}>{k.styleName}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <p
                  className="text-xs font-medium mb-1 block"
                  style={{ color: "#64748b" }}
                >
                  Search
                </p>
                <div className="relative">
                  <Search
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                    style={{ color: "#94a3b8" }}
                  />
                  <Input
                    placeholder="Filter styles..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSelectedStyleCode("__first__");
                    }}
                    className="pl-8 h-9 text-xs w-44"
                  />
                </div>
              </div>

              <div>
                <p
                  className="text-xs font-medium mb-1 block"
                  style={{ color: "#64748b" }}
                >
                  Action
                </p>
                <Select
                  value={actionFilter}
                  onValueChange={(v) => {
                    setActionFilter(v);
                    setSelectedStyleCode("__first__");
                  }}
                >
                  <SelectTrigger className="w-36 h-9 text-xs">
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
              </div>

              <div>
                <p
                  className="text-xs font-medium mb-1 block"
                  style={{ color: "#64748b" }}
                >
                  Performance
                </p>
                <Select
                  value={perfFilter}
                  onValueChange={(v) => {
                    setPerfFilter(v);
                    setSelectedStyleCode("__first__");
                  }}
                >
                  <SelectTrigger className="w-40 h-9 text-xs">
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

              <div className="ml-auto text-xs" style={{ color: "#94a3b8" }}>
                {displayed.length} of {filteredKPIs.length} styles
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Single Style Card */}
      {selectedKPI ? (
        <motion.div
          key={selectedKPI.styleCode}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <StyleCard
            kpi={selectedKPI}
            allKPIs={filteredKPIs}
            imageUrl={selectedVMEntry?.imageUrl}
            zone={selectedVMEntry?.zone || selectedKPI.category}
          />
        </motion.div>
      ) : (
        <div
          className="py-12 text-center text-sm mb-6"
          style={{ color: "#94a3b8" }}
        >
          No styles match the current filters.
        </div>
      )}

      {/* Detail Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="shadow-card border-0">
          <CardHeader className="pb-3">
            <CardTitle
              className="text-sm font-semibold"
              style={{ color: "#0f172a" }}
            >
              All Styles – Decision Intelligence
            </CardTitle>
            <p className="text-xs" style={{ color: "#94a3b8" }}>
              Click a row to view full style details above
            </p>
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
                        "Photo",
                        "Style",
                        "Zone",
                        "ROS",
                        "Sell-Through",
                        "Sales",
                        "Perf. Index",
                        "Rebuy Trigger",
                        "Stock Status",
                        "Action",
                        "Inv. Health",
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
                      const categoryAvgRos = getZoneAvgRos(k, filteredKPIs);
                      const { index: perfIdx, label: perfLabel } = getPerfIndex(
                        k,
                        filteredKPIs,
                      );
                      const trigger = getRebuytrigger(k);
                      const stockStatus = getStockStatus(k);
                      const action = getAction(k);
                      const { label: healthLabel } = getHealthScore(k);
                      const recommendation = getSmartRecommendation(
                        k,
                        filteredKPIs,
                      );
                      const ros4w = k.ros4Week ?? k.ros;

                      const vmEntry = vmDeckData[k.styleCode];
                      const imageUrl = vmEntry?.imageUrl;
                      const zone = vmEntry?.zone || k.category;
                      const isSelected = selectedKPI?.styleCode === k.styleCode;

                      return (
                        <TableRow
                          key={`${k.styleCode}-${k.season}-${idx}`}
                          className="cursor-pointer"
                          style={{
                            background: isSelected
                              ? "#fefce8"
                              : idx % 2 === 1
                                ? "#f8fafc"
                                : "white",
                            outline: isSelected ? "2px solid #d97706" : "none",
                          }}
                          onClick={() => setSelectedStyleCode(k.styleCode)}
                        >
                          {/* Photo */}
                          <TableCell className="py-2">
                            <StylePhoto
                              imageUrl={imageUrl}
                              styleCode={k.styleCode}
                            />
                          </TableCell>

                          {/* Style */}
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

                          {/* Zone */}
                          <TableCell className="min-w-[80px]">
                            <span
                              className="text-xs px-2 py-1 rounded-full font-medium"
                              style={{
                                background: "#ede9fe",
                                color: "#5b21b6",
                              }}
                            >
                              {zone}
                            </span>
                          </TableCell>

                          {/* ROS */}
                          <TableCell className="min-w-[90px]">
                            <p
                              className="text-xs font-semibold"
                              style={{ color: "#0f172a" }}
                            >
                              {ros4w.toFixed(1)}
                              <span
                                className="text-xs font-normal ml-0.5"
                                style={{ color: "#94a3b8" }}
                              >
                                /wk
                              </span>
                            </p>
                            <p
                              className="text-xs mt-0.5"
                              style={{ color: "#94a3b8" }}
                            >
                              Cat avg: {categoryAvgRos.toFixed(1)}
                            </p>
                          </TableCell>

                          {/* Sell-Through */}
                          <TableCell className="min-w-[100px]">
                            <div className="flex flex-col gap-1">
                              <p
                                className="text-xs font-semibold"
                                style={{ color: "#0f172a" }}
                              >
                                {k.sellThroughPct}%
                              </p>
                              <div
                                className="w-16 h-1.5 rounded-full overflow-hidden"
                                style={{ background: "#f1f5f9" }}
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, k.sellThroughPct)}%`,
                                    background:
                                      k.sellThroughPct >= 70
                                        ? "#16a34a"
                                        : k.sellThroughPct >= 40
                                          ? "#d97706"
                                          : "#dc2626",
                                  }}
                                />
                              </div>
                            </div>
                          </TableCell>

                          {/* Sales */}
                          <TableCell className="min-w-[80px]">
                            <p
                              className="text-xs font-semibold"
                              style={{ color: "#0f172a" }}
                            >
                              {k.totalSalesUnits.toLocaleString()}
                            </p>
                            <p className="text-xs" style={{ color: "#94a3b8" }}>
                              units
                            </p>
                          </TableCell>

                          {/* Perf. Index */}
                          <TableCell className="min-w-[140px]">
                            <PerfBadge label={perfLabel} />
                            <p
                              className="text-xs mt-1"
                              style={{ color: "#94a3b8" }}
                            >
                              Index: {perfIdx}×
                            </p>
                            <p
                              className="text-xs mt-0.5"
                              style={{ color: "#94a3b8" }}
                            >
                              4W ROS: {ros4w.toFixed(1)} | Cat Avg:{" "}
                              {categoryAvgRos.toFixed(1)}
                            </p>
                          </TableCell>

                          {/* Rebuy Trigger */}
                          <TableCell>
                            <TriggerBadge value={trigger} />
                          </TableCell>

                          {/* Stock Status */}
                          <TableCell>
                            <StockBadge value={stockStatus} />
                            <p
                              className="text-xs mt-1"
                              style={{ color: "#94a3b8" }}
                            >
                              {k.inventoryCoverWeeks.toFixed(1)} wks
                            </p>
                          </TableCell>

                          {/* Action */}
                          <TableCell>
                            <ActionBadge value={action} />
                          </TableCell>

                          {/* Inv. Health */}
                          <TableCell>
                            <HealthBadge label={healthLabel} />
                          </TableCell>

                          {/* Recommendation */}
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
