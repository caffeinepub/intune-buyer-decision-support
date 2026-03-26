import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Building2,
  Calendar,
  Clock,
  Package,
  Search,
  TrendingUp,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Layout } from "../components/Layout";
import { useData } from "../context/DataContext";
import { getSizeAllocations } from "../data/sampleData";
import type { SizeAllocation } from "../types";

const actionDecisionConfig: Record<
  string,
  { bg: string; text: string; borderColor: string }
> = {
  "Re-buy": { bg: "#15803d", text: "white", borderColor: "#166534" },
  Exit: { bg: "#b91c1c", text: "white", borderColor: "#991b1b" },
};

type RebuyFilter = "all" | "Re-buy";

// GCD helper for ratio normalization
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function normalizeToRatio(parts: number[]): number[] {
  const rounded = parts.map((p) => Math.max(1, Math.round(p)));
  const g = rounded.reduce((acc, p) => gcd(acc, p), rounded[0] ?? 1);
  return g > 0 ? rounded.map((p) => Math.round(p / g)) : rounded;
}

export function RebuySize() {
  const { data, filters, filteredKPIs } = useData();

  const [rebuyFilter, setRebuyFilter] = useState<RebuyFilter>("all");
  const [styleSearch, setStyleSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [totalQty, setTotalQty] = useState(0);

  // Summary stats for empty state
  const summaryStats = useMemo(() => {
    const rebuyStyles = data.supplyChain.filter(
      (s) => s.decision === "Immediate Re-buy Required",
    );
    const exitStyles = data.supplyChain.filter(
      (s) => s.decision === "Do Not Re-buy",
    );
    const topRebuy = filteredKPIs
      .filter((k) => k.classification === "Re-buy Candidate")
      .sort((a, b) => b.buyingScore - a.buyingScore)
      .slice(0, 5);
    const categories = Array.from(new Set(filteredKPIs.map((k) => k.category)));
    const categoryBreakdown = categories.map((cat) => ({
      cat,
      rebuy: filteredKPIs.filter(
        (k) => k.category === cat && k.classification === "Re-buy Candidate",
      ).length,
      total: filteredKPIs.filter((k) => k.category === cat).length,
    }));
    return { rebuyStyles, exitStyles, topRebuy, categoryBreakdown };
  }, [data.supplyChain, filteredKPIs]);

  const styleOptions = useMemo(() => {
    const seen = new Set<string>();
    return data.kpis
      .filter((k) => filters.season === "all" || k.season === filters.season)
      .filter((k) => {
        const key = `${k.styleCode}||${k.season}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((k) => {
        const supply = data.supplyChain.find(
          (s) => s.styleCode === k.styleCode && s.season === k.season,
        );
        const isRebuy = supply?.decision === "Immediate Re-buy Required";
        return {
          value: `${k.styleCode}||${k.season}`,
          label: `${k.styleCode} (${k.season})`,
          styleCode: k.styleCode,
          styleName: k.styleName,
          isRebuy,
        };
      })
      .filter((opt) => rebuyFilter === "all" || opt.isRebuy)
      .filter((opt) => {
        if (!styleSearch.trim()) return true;
        const searchTrimmed = styleSearch.trim();
        const digits = searchTrimmed.replace(/\D/g, "");
        if (!digits) {
          return (
            opt.styleCode.toLowerCase().includes(searchTrimmed.toLowerCase()) ||
            opt.styleName.toLowerCase().includes(searchTrimmed.toLowerCase())
          );
        }
        return (
          opt.styleCode.trim().endsWith(digits) ||
          opt.styleName.trim().endsWith(digits)
        );
      });
  }, [data.kpis, data.supplyChain, filters.season, rebuyFilter, styleSearch]);

  const [styleCode, season] = selectedKey.split("||");

  // Auto-populate totalQty from uploaded size data when a style is selected
  useEffect(() => {
    if (!styleCode) {
      setTotalQty(0);
      return;
    }
    const sizes = data.sizeData?.[styleCode];
    if (sizes && sizes.length > 0) {
      const total = sizes.reduce((sum, s) => sum + s.ratioPart, 0);
      if (total > 0) {
        setTotalQty(total);
        return;
      }
    }
    // Fallback: estimate from inventory cover * ROS
    const kpi = data.kpis.find((k) => k.styleCode === styleCode);
    if (kpi && kpi.ros > 0 && kpi.inventoryCoverWeeks > 0) {
      setTotalQty(Math.round(kpi.ros * kpi.inventoryCoverWeeks));
      return;
    }
    setTotalQty(500);
  }, [styleCode, data.sizeData, data.kpis]);

  const supplyData = data.supplyChain.find(
    (s) => s.styleCode === styleCode && s.season === season,
  );

  const actionLabel: string =
    supplyData?.decision === "Immediate Re-buy Required" ? "Re-buy" : "Exit";

  const sizeAllocs: SizeAllocation[] = useMemo(() => {
    if (!styleCode) return [];
    const fromFile = data.sizeData?.[styleCode];
    if (fromFile && fromFile.length > 0) {
      return fromFile.map((s) => ({
        ...s,
        suggestedRebuyQty: Math.round((s.sizeContributionPct / 100) * totalQty),
      }));
    }
    return getSizeAllocations(styleCode, totalQty);
  }, [styleCode, totalQty, data.sizeData]);

  const hasRealSizeData = styleCode && !!data.sizeData?.[styleCode]?.length;
  const decisionStyle = actionDecisionConfig[actionLabel] ?? null;

  // Normalize ratio parts for display (e.g. 100:200:150 → 2:4:3)
  const sizeRatioStr = useMemo(() => {
    if (sizeAllocs.length === 0) return "—";
    const rawParts = sizeAllocs.map((s) => s.ratioPart);
    const normalized = normalizeToRatio(rawParts);
    return normalized.join(" : ");
  }, [sizeAllocs]);

  const finalDecisionOutput = `${actionLabel} | ${totalQty.toLocaleString()} units | ${sizeRatioStr}`;

  const vendorName = supplyData?.vendor || "—";

  return (
    <Layout title="Re-buy & Size Planning – Modules 2 & 3">
      {/* Filters & Style Selector */}
      <Card className="shadow-card border-0 mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
            <div>
              <Label
                className="text-xs mb-1.5 block"
                style={{ color: "#64748b" }}
              >
                Filter by Re-buy Option
              </Label>
              <Select
                value={rebuyFilter}
                onValueChange={(v) => {
                  setRebuyFilter(v as RebuyFilter);
                  setSelectedKey("");
                }}
              >
                <SelectTrigger
                  className="h-9 text-xs"
                  data-ocid="rebuy.filter.select"
                >
                  <SelectValue placeholder="Filter Re-buy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Styles</SelectItem>
                  <SelectItem value="Re-buy">Re-buy Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label
                className="text-xs mb-1.5 block"
                style={{ color: "#64748b" }}
              >
                Search by Last Style Digits
              </Label>
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: "#94a3b8" }}
                />
                <Input
                  placeholder="e.g. 4521"
                  value={styleSearch}
                  onChange={(e) => {
                    setStyleSearch(e.target.value);
                    setSelectedKey("");
                  }}
                  className="pl-8 h-9 text-xs"
                  data-ocid="rebuy.style.search"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <Label
                className="text-xs mb-1.5 block"
                style={{ color: "#64748b" }}
              >
                Select Style & Season
                {styleOptions.length > 0 && (
                  <span className="ml-1" style={{ color: "#b45309" }}>
                    ({styleOptions.length} styles)
                  </span>
                )}
              </Label>
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger className="h-9" data-ocid="rebuy.style.select">
                  <SelectValue placeholder="Choose a style to analyze..." />
                </SelectTrigger>
                <SelectContent>
                  {styleOptions.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No styles match filters
                    </SelectItem>
                  ) : (
                    styleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedKey && (
            <div className="mt-3">
              <Label
                className="text-xs mb-1.5 block"
                style={{ color: "#64748b" }}
              >
                Total Re-buy Quantity
                {hasRealSizeData && (
                  <span className="ml-1" style={{ color: "#16a34a" }}>
                    (from uploaded data)
                  </span>
                )}
              </Label>
              <Input
                type="number"
                min={1}
                value={totalQty}
                onChange={(e) =>
                  setTotalQty(Math.max(1, Number.parseInt(e.target.value) || 0))
                }
                className="h-9 w-36 text-sm"
                data-ocid="rebuy.qty.input"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedKey && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
          data-ocid="rebuy.empty_state"
        >
          {/* Summary KPI row */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-0" style={{ background: "#0f172a" }}>
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(251,191,36,0.15)" }}
                >
                  <TrendingUp
                    className="w-6 h-6"
                    style={{ color: "#fbbf24" }}
                  />
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>
                    Styles for Re-buy
                  </p>
                  <p
                    className="text-3xl font-bold"
                    style={{ color: "#fbbf24" }}
                  >
                    {summaryStats.rebuyStyles.length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0" style={{ background: "#0f172a" }}>
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(220,38,38,0.15)" }}
                >
                  <Package className="w-6 h-6" style={{ color: "#f87171" }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>
                    Styles to Exit
                  </p>
                  <p
                    className="text-3xl font-bold"
                    style={{ color: "#f87171" }}
                  >
                    {summaryStats.exitStyles.length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-card">
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "#fef3c7" }}
                >
                  <Zap className="w-6 h-6" style={{ color: "#b45309" }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#64748b" }}>
                    Re-buy Rate
                  </p>
                  <p
                    className="text-3xl font-bold"
                    style={{ color: "#b45309" }}
                  >
                    {data.supplyChain.length > 0
                      ? Math.round(
                          (summaryStats.rebuyStyles.length /
                            data.supplyChain.length) *
                            100,
                        )
                      : 0}
                    %
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Re-buy Candidates + Category Breakdown */}
          <div className="grid grid-cols-2 gap-5">
            <Card className="shadow-card border-0">
              <CardHeader className="pb-2">
                <CardTitle
                  className="text-sm font-semibold"
                  style={{ color: "#0f172a" }}
                >
                  Top Re-buy Candidates
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {summaryStats.topRebuy.length === 0 ? (
                  <p
                    className="text-sm text-center py-8"
                    style={{ color: "#94a3b8" }}
                  >
                    Upload an Excel file to see candidates
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow style={{ background: "#f8fafc" }}>
                        {["Style", "Category", "ROS", "Score"].map((h) => (
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
                      {summaryStats.topRebuy.map((k, idx) => (
                        <TableRow
                          key={k.styleCode}
                          style={{
                            background: idx % 2 === 1 ? "#f8fafc" : "white",
                          }}
                        >
                          <TableCell
                            className="text-xs font-mono font-bold"
                            style={{ color: "#b45309" }}
                          >
                            {k.styleCode}
                          </TableCell>
                          <TableCell
                            className="text-xs"
                            style={{ color: "#64748b" }}
                          >
                            {k.category}
                          </TableCell>
                          <TableCell
                            className="text-xs font-semibold"
                            style={{ color: "#0f172a" }}
                          >
                            {k.ros.toFixed(1)}
                          </TableCell>
                          <TableCell>
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: "#dcfce7",
                                color: "#15803d",
                              }}
                            >
                              {k.buyingScore}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card border-0">
              <CardHeader className="pb-3">
                <CardTitle
                  className="text-sm font-semibold"
                  style={{ color: "#0f172a" }}
                >
                  Re-buy by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summaryStats.categoryBreakdown.length === 0 ? (
                  <p
                    className="text-sm text-center py-8"
                    style={{ color: "#94a3b8" }}
                  >
                    Upload an Excel file to see breakdown
                  </p>
                ) : (
                  <div className="space-y-3">
                    {summaryStats.categoryBreakdown.map((c) => {
                      const pct =
                        c.total > 0 ? Math.round((c.rebuy / c.total) * 100) : 0;
                      return (
                        <div key={c.cat}>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className="text-xs font-medium"
                              style={{ color: "#0f172a" }}
                            >
                              {c.cat}
                            </span>
                            <span
                              className="text-xs"
                              style={{ color: "#64748b" }}
                            >
                              {c.rebuy} / {c.total} styles
                            </span>
                          </div>
                          <div
                            className="h-2 rounded-full"
                            style={{ background: "#f1f5f9" }}
                          >
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background:
                                  pct >= 60
                                    ? "#16a34a"
                                    : pct >= 30
                                      ? "#d97706"
                                      : "#dc2626",
                              }}
                            />
                          </div>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: "#94a3b8" }}
                          >
                            {pct}% re-buy rate
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div
            className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-10 text-center"
            style={{
              borderColor: "#fbbf24",
              background: "rgba(251,191,36,0.04)",
            }}
          >
            <TrendingUp
              className="w-10 h-10 mb-3"
              style={{ color: "#fbbf24" }}
            />
            <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>
              Select a Style Above to Begin Planning
            </p>
            <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
              Search by last style digits or filter by re-buy option, then
              choose a style
            </p>
          </div>
        </motion.div>
      )}

      {selectedKey && supplyData && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Final Decision Output — top highlight */}
          <div
            className="rounded-xl px-6 py-4 flex flex-col items-center justify-center gap-1"
            style={{ background: "#0f172a", border: "2px solid #fbbf24" }}
            data-ocid="rebuy.final_decision_output"
          >
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#fbbf24" }}
            >
              🎯 Final Decision Output
            </p>
            <p
              className="text-xl font-bold tracking-wide text-center"
              style={{ color: "white" }}
            >
              {finalDecisionOutput}
            </p>
          </div>

          {/* Module 2: Supply Chain */}
          <Card className="shadow-card border-0">
            <CardHeader className="pb-3">
              <CardTitle
                className="text-sm font-semibold"
                style={{ color: "#0f172a" }}
              >
                Module 2 — Strategic Supply Chain Check
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 mb-5">
                {[
                  {
                    label: "Vendor Name",
                    value: vendorName,
                    icon: Building2,
                    color: "#7c3aed",
                    bg: "#ede9fe",
                  },
                  {
                    label: "Vendor Lead Time",
                    value: `${supplyData.vendorLeadTimeDays} days`,
                    icon: Clock,
                    color: "#b45309",
                    bg: "#fef3c7",
                  },
                  {
                    label: "Season Runway",
                    value: `${supplyData.seasonRunwayWeeks} wks`,
                    icon: Calendar,
                    color: "#0891b2",
                    bg: "#e0f2fe",
                  },
                  {
                    label: "Velocity Profile",
                    value: supplyData.velocityProfile,
                    icon: Zap,
                    color:
                      supplyData.velocityProfile === "Fast"
                        ? "#16a34a"
                        : supplyData.velocityProfile === "Medium"
                          ? "#d97706"
                          : "#dc2626",
                    bg:
                      supplyData.velocityProfile === "Fast"
                        ? "#dcfce7"
                        : supplyData.velocityProfile === "Medium"
                          ? "#fef3c7"
                          : "#fee2e2",
                  },
                ].map((tile) => (
                  <div
                    key={tile.label}
                    className="rounded-lg p-4 border"
                    style={{ borderColor: "#e2e8f0", background: "white" }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center"
                        style={{ background: tile.bg }}
                      >
                        <tile.icon
                          className="w-3.5 h-3.5"
                          style={{ color: tile.color }}
                        />
                      </div>
                      <p className="text-xs" style={{ color: "#64748b" }}>
                        {tile.label}
                      </p>
                    </div>
                    <p
                      className="text-xl font-bold truncate"
                      style={{ color: tile.color }}
                    >
                      {tile.value}
                    </p>
                  </div>
                ))}
              </div>

              {decisionStyle && (
                <div
                  className="w-full rounded-lg px-6 py-4 flex items-center justify-center"
                  style={{
                    background: decisionStyle.bg,
                    border: `2px solid ${decisionStyle.borderColor}`,
                  }}
                  data-ocid="rebuy.decision.panel"
                >
                  <p
                    className="text-xl font-bold tracking-wide"
                    style={{ color: decisionStyle.text }}
                  >
                    🎯 {actionLabel}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Module 3: Size Allocation */}
          <Card className="shadow-card border-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle
                  className="text-sm font-semibold"
                  style={{ color: "#0f172a" }}
                >
                  Module 3 — Size Level Inventory Allocation
                </CardTitle>
                {hasRealSizeData && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "#dcfce7", color: "#16a34a" }}
                  >
                    From uploaded file
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Table data-ocid="rebuy.size.table">
                    <TableHeader>
                      <TableRow style={{ background: "#f8fafc" }}>
                        {[
                          "Size",
                          "Ratio",
                          "Contribution %",
                          "Suggested Qty",
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
                      {(() => {
                        const rawParts = sizeAllocs.map((s) => s.ratioPart);
                        const normalized = normalizeToRatio(rawParts);
                        return sizeAllocs.map((s, idx) => (
                          <TableRow
                            key={s.size}
                            data-ocid={`rebuy.size.item.${idx + 1}`}
                            style={{
                              background: idx % 2 === 1 ? "#f8fafc" : "white",
                            }}
                          >
                            <TableCell
                              className="text-xs font-bold"
                              style={{ color: "#0f172a" }}
                            >
                              {s.size}
                            </TableCell>
                            <TableCell
                              className="text-xs"
                              style={{ color: "#64748b" }}
                            >
                              {normalized[idx]}
                            </TableCell>
                            <TableCell
                              className="text-xs"
                              style={{ color: "#0f172a" }}
                            >
                              {s.sizeContributionPct}%
                            </TableCell>
                            <TableCell
                              className="text-xs font-bold"
                              style={{ color: "#b45309" }}
                            >
                              {s.suggestedRebuyQty}
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                  <p className="text-xs mt-2" style={{ color: "#94a3b8" }}>
                    Total: {totalQty.toLocaleString()} units
                  </p>
                </div>

                <div>
                  <p
                    className="text-xs font-medium mb-3"
                    style={{ color: "#64748b" }}
                  >
                    Size Distribution
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={sizeAllocs}
                      margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="size"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                        }}
                        formatter={(value: number) => [`${value} units`, "Qty"]}
                      />
                      <Bar
                        dataKey="suggestedRebuyQty"
                        fill="oklch(0.82 0.18 88)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Final Buyer Output */}
          <Card
            className="border-0"
            data-ocid="rebuy.final_output.card"
            style={{ background: "#0f172a" }}
          >
            <CardHeader className="pb-3">
              <CardTitle
                className="text-sm font-bold tracking-widest uppercase"
                style={{ color: "#fbbf24", letterSpacing: "0.15em" }}
              >
                Final Buyer Output
              </CardTitle>
              <div
                style={{
                  height: 1,
                  background: "rgba(251,191,36,0.3)",
                  marginTop: 4,
                }}
              />
            </CardHeader>
            <CardContent>
              {/* Compact Final Decision Output line */}
              <div
                className="rounded-lg px-4 py-3 mb-5 text-center"
                style={{
                  background: "rgba(251,191,36,0.12)",
                  border: "1px solid rgba(251,191,36,0.4)",
                }}
              >
                <p
                  className="text-xs uppercase tracking-widest mb-1"
                  style={{ color: "#94a3b8" }}
                >
                  Final Decision Output
                </p>
                <p className="text-base font-bold" style={{ color: "#fbbf24" }}>
                  {finalDecisionOutput}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "#94a3b8" }}
                  >
                    Rebuy Decision
                  </p>
                  <p
                    className="text-3xl font-bold mt-1"
                    style={{
                      color: actionLabel !== "Exit" ? "#4ade80" : "#f87171",
                    }}
                  >
                    {actionLabel !== "Exit" ? "YES" : "NO"}
                  </p>
                </div>
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "#94a3b8" }}
                  >
                    Vendor
                  </p>
                  <p
                    className="text-xl font-bold mt-1 truncate"
                    style={{ color: "#fbbf24" }}
                  >
                    {vendorName}
                  </p>
                </div>
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "#94a3b8" }}
                  >
                    Total Quantity
                  </p>
                  <p
                    className="text-3xl font-bold mt-1"
                    style={{ color: "white" }}
                  >
                    {totalQty.toLocaleString()}{" "}
                    <span
                      className="text-lg font-normal"
                      style={{ color: "#94a3b8" }}
                    >
                      units
                    </span>
                  </p>
                </div>
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "#94a3b8" }}
                  >
                    Size Ratio
                  </p>
                  <p
                    className="text-2xl font-bold mt-1"
                    style={{ color: "#fbbf24" }}
                  >
                    {sizeRatioStr}
                  </p>
                </div>
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "#94a3b8" }}
                  >
                    Action
                  </p>
                  <p
                    className="text-xl font-bold mt-1"
                    style={{ color: "white" }}
                  >
                    {actionLabel}
                  </p>
                </div>
              </div>
              <p
                className="text-xs mt-6 text-center"
                style={{
                  color: "rgba(148,163,184,0.6)",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  paddingTop: 12,
                }}
              >
                Generated by INTUNE Buyer DSS — Shoppers Stop
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {selectedKey && !supplyData && (
        <Card className="shadow-card border-0">
          <CardContent className="py-12 text-center">
            <p className="text-sm" style={{ color: "#94a3b8" }}>
              Supply chain data not available for this style.
            </p>
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}
