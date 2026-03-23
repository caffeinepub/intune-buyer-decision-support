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
  Search,
  TrendingUp,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
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

type RebuyFilter = "all" | "Re-buy" | "Exit";

function getActionLabel(
  supplyDecision: string,
  _velocityProfile: string,
): RebuyFilter {
  if (supplyDecision === "Immediate Re-buy Required") return "Re-buy";
  return "Exit";
}

export function RebuySize() {
  const { data, filters } = useData();

  const [rebuyFilter, setRebuyFilter] = useState<RebuyFilter>("all");
  const [styleSearch, setStyleSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [totalQty, setTotalQty] = useState(500);

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
        const action: RebuyFilter = supply
          ? getActionLabel(supply.decision, supply.velocityProfile)
          : "Exit";
        return {
          value: `${k.styleCode}||${k.season}`,
          label: `${k.styleName} (${k.season})`,
          styleCode: k.styleCode,
          action,
        };
      })
      .filter((opt) => rebuyFilter === "all" || opt.action === rebuyFilter)
      .filter((opt) => {
        if (!styleSearch.trim()) return true;
        const digits = styleSearch.trim().replace(/\D/g, "");
        if (!digits)
          return opt.styleCode
            .toLowerCase()
            .includes(styleSearch.trim().toLowerCase());
        return opt.styleCode.endsWith(digits);
      });
  }, [data.kpis, data.supplyChain, filters.season, rebuyFilter, styleSearch]);

  const [styleCode, season] = selectedKey.split("||");

  const supplyData = data.supplyChain.find(
    (s) => s.styleCode === styleCode && s.season === season,
  );

  const actionLabel: string = supplyData
    ? getActionLabel(supplyData.decision, supplyData.velocityProfile)
    : "Exit";

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

  const sizeRatioStr =
    sizeAllocs.length > 0
      ? sizeAllocs.map((s) => s.ratioPart).join(" : ")
      : "—";
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
                  <SelectValue placeholder="All Re-buy Options" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Re-buy Options</SelectItem>
                  <SelectItem value="Re-buy">Re-buy</SelectItem>
                  <SelectItem value="Exit">Exit</SelectItem>
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
        <div
          className="flex flex-col items-center justify-center py-24 text-center"
          data-ocid="rebuy.empty_state"
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: "#fef3c7" }}
          >
            <TrendingUp className="w-8 h-8" style={{ color: "#b45309" }} />
          </div>
          <p className="text-base font-semibold" style={{ color: "#0f172a" }}>
            Select a Style to Begin Analysis
          </p>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            Use the filters above to narrow down styles, then choose one to
            analyse
          </p>
        </div>
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
                      {sizeAllocs.map((s, idx) => (
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
                            {s.ratioPart}
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
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-xs mt-2" style={{ color: "#94a3b8" }}>
                    Total: {totalQty} units
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
