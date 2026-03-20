import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { Brain, Search } from "lucide-react";
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
import { ClassificationBadge } from "../components/ClassificationBadge";
import { Layout } from "../components/Layout";
import { useData } from "../context/DataContext";
import type { Classification, KPIResult } from "../types/index";

const classColors: Record<Classification, string> = {
  "Re-buy Candidate": "#16a34a",
  Monitor: "#d97706",
  "Do Not Re-buy": "#dc2626",
};

const SCORE_BUCKETS = [
  { label: "0–20", min: 0, max: 20 },
  { label: "21–40", min: 21, max: 40 },
  { label: "41–60", min: 41, max: 60 },
  { label: "61–80", min: 61, max: 80 },
  { label: "81–100", min: 81, max: 100 },
];

type DecisionType = "Aggressive Rebuy" | "Moderate Rebuy" | "Exit";
type RiskType = "High Risk" | "Medium" | "Low Risk";

function getDecision(k: KPIResult): DecisionType {
  if (k.classification === "Re-buy Candidate" && k.buyingScore >= 70)
    return "Aggressive Rebuy";
  if (
    (k.classification === "Re-buy Candidate" && k.buyingScore < 70) ||
    k.classification === "Monitor"
  )
    return "Moderate Rebuy";
  return "Exit";
}

function getRisk(k: KPIResult): RiskType {
  if (k.inventoryCoverWeeks > 12) return "High Risk";
  if (k.inventoryCoverWeeks >= 6) return "Medium";
  return "Low Risk";
}

function getRecommendation(k: KPIResult): string {
  const risk = getRisk(k);
  if (k.ros >= 8 && risk === "Low Risk")
    return "High ROS with low cover — replenish immediately.";
  if (k.ros >= 8 && risk === "Medium")
    return "Good velocity — monitor stock levels.";
  if (k.ros < 4 && risk === "High Risk")
    return "Low sales and overstocked — consider markdown.";
  if (k.ros < 4) return "Weak performer — recommend exit.";
  return "Moderate performance — review before rebuy.";
}

function DecisionBadge({ value }: { value: DecisionType }) {
  if (value === "Aggressive Rebuy")
    return (
      <Badge
        className="text-xs font-medium"
        style={{ background: "#dcfce7", color: "#15803d", border: "none" }}
      >
        Aggressive Rebuy
      </Badge>
    );
  if (value === "Moderate Rebuy")
    return (
      <Badge
        className="text-xs font-medium"
        style={{ background: "#fef3c7", color: "#b45309", border: "none" }}
      >
        Moderate Rebuy
      </Badge>
    );
  return (
    <Badge
      className="text-xs font-medium"
      style={{ background: "#fee2e2", color: "#b91c1c", border: "none" }}
    >
      Exit
    </Badge>
  );
}

function RiskBadge({ value }: { value: RiskType }) {
  if (value === "High Risk")
    return (
      <Badge
        className="text-xs font-medium"
        style={{ background: "#fee2e2", color: "#b91c1c", border: "none" }}
      >
        High Risk
      </Badge>
    );
  if (value === "Medium")
    return (
      <Badge
        className="text-xs font-medium"
        style={{ background: "#fef3c7", color: "#b45309", border: "none" }}
      >
        Medium
      </Badge>
    );
  return (
    <Badge
      className="text-xs font-medium"
      style={{ background: "#dcfce7", color: "#15803d", border: "none" }}
    >
      Low Risk
    </Badge>
  );
}

export function StyleAnalysis() {
  const { filteredKPIs } = useData();
  const [sortBy, setSortBy] = useState<
    "buyingScore" | "ros" | "grossMarginPct"
  >("buyingScore");
  const [classFilter, setClassFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");
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
        const avgRos = items.length
          ? Number.parseFloat(
              (items.reduce((s, k) => s + k.ros, 0) / items.length).toFixed(1),
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
        return { cat, avgScore, avgRos, rebuyPct, count: items.length };
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

  // Table data with derived columns
  const displayed = useMemo(() => {
    return [...filteredKPIs]
      .filter((k) => classFilter === "all" || k.classification === classFilter)
      .filter((k) => {
        if (decisionFilter === "all") return true;
        return getDecision(k) === decisionFilter;
      })
      .filter((k) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          k.styleCode.toLowerCase().includes(q) ||
          k.styleName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [filteredKPIs, classFilter, decisionFilter, search, sortBy]);

  return (
    <Layout title="Style Analysis – Module 1">
      {/* Decision Logic Box */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
        className="mb-6"
      >
        <Card
          className="border-0"
          style={{ background: "#fef3c7", border: "1px solid #fde68a" }}
        >
          <CardHeader className="pb-3">
            <CardTitle
              className="text-sm font-semibold flex items-center gap-2"
              style={{ color: "#92400e" }}
            >
              <Brain className="w-4 h-4" style={{ color: "#b45309" }} />
              Decision Logic — How This Tool Thinks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p
                  className="text-xs font-bold mb-1"
                  style={{ color: "#78350f" }}
                >
                  ROS vs Zone Average
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "#92400e" }}
                >
                  If a style's Rate of Sale exceeds its zone average, it scores
                  higher for rebuy. A higher-than-average ROS signals strong
                  customer demand relative to its peer group.
                </p>
              </div>
              <div>
                <p
                  className="text-xs font-bold mb-1"
                  style={{ color: "#78350f" }}
                >
                  Stock Cover Weeks
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "#92400e" }}
                >
                  <span className="font-semibold">Cover &gt;12 wks</span> = High
                  Risk (markdown candidate).
                  <br />
                  <span className="font-semibold">6–12 wks</span> = Medium —
                  monitor closely.
                  <br />
                  <span className="font-semibold">&lt;6 wks</span> = Safe —
                  replenishment recommended.
                </p>
              </div>
              <div>
                <p
                  className="text-xs font-bold mb-1"
                  style={{ color: "#78350f" }}
                >
                  Final Decision Logic
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "#92400e" }}
                >
                  <span className="font-semibold">Score ≥70</span> → Aggressive
                  Rebuy
                  <br />
                  <span className="font-semibold">Score 40–69</span> → Moderate
                  Rebuy
                  <br />
                  <span className="font-semibold">Score &lt;40</span> → Exit —
                  discontinue this style
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        {/* Category Performance */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="shadow-card border-0 h-full">
            <CardHeader className="pb-2">
              <CardTitle
                className="text-sm font-semibold"
                style={{ color: "#0f172a" }}
              >
                Avg Buying Score by Category
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

        {/* Score Distribution */}
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
                        fill={
                          d.label === "81–100"
                            ? "#16a34a"
                            : d.label === "61–80"
                              ? "#84cc16"
                              : d.label === "41–60"
                                ? "#d97706"
                                : d.label === "21–40"
                                  ? "#f97316"
                                  : "#dc2626"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div
                className="mt-2 flex items-center gap-4 text-xs"
                style={{ color: "#64748b" }}
              >
                <span className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ background: "#16a34a" }}
                  />
                  High (81–100)
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ background: "#d97706" }}
                  />
                  Mid (41–60)
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ background: "#dc2626" }}
                  />
                  Low (0–20)
                </span>
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
              <CardTitle
                className="text-sm font-semibold"
                style={{ color: "#0f172a" }}
              >
                Style-Level Performance Detail
              </CardTitle>
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
                    data-ocid="style.search_input"
                  />
                </div>
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger
                    className="w-40 h-8 text-xs"
                    data-ocid="style.classification.select"
                  >
                    <SelectValue placeholder="Classification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classifications</SelectItem>
                    <SelectItem value="Re-buy Candidate">
                      Re-buy Candidate
                    </SelectItem>
                    <SelectItem value="Monitor">Monitor</SelectItem>
                    <SelectItem value="Do Not Re-buy">Do Not Re-buy</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={decisionFilter}
                  onValueChange={setDecisionFilter}
                >
                  <SelectTrigger
                    className="w-40 h-8 text-xs"
                    data-ocid="style.decision.select"
                  >
                    <SelectValue placeholder="Decision" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Decisions</SelectItem>
                    <SelectItem value="Aggressive Rebuy">
                      Aggressive Rebuy
                    </SelectItem>
                    <SelectItem value="Moderate Rebuy">
                      Moderate Rebuy
                    </SelectItem>
                    <SelectItem value="Exit">Exit</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as typeof sortBy)}
                >
                  <SelectTrigger
                    className="w-36 h-8 text-xs"
                    data-ocid="style.sort.select"
                  >
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyingScore">Buying Score</SelectItem>
                    <SelectItem value="ros">ROS</SelectItem>
                    <SelectItem value="grossMarginPct">Gross Margin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
              {displayed.length} of {filteredKPIs.length} styles shown
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {displayed.length === 0 ? (
              <div
                className="py-12 text-center text-sm"
                style={{ color: "#94a3b8" }}
                data-ocid="style.empty_state"
              >
                No styles match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table data-ocid="style.table">
                  <TableHeader>
                    <TableRow style={{ background: "#f8fafc" }}>
                      {[
                        "Style Code",
                        "Style Name",
                        "Season",
                        "Category",
                        "ROS",
                        "Inv Cover",
                        "GM%",
                        "Buying Score",
                        "Classification",
                        "Decision",
                        "Risk",
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
                    {displayed.map((k, idx) => (
                      <TableRow
                        key={k.styleCode}
                        data-ocid={`style.item.${idx + 1}`}
                        style={{
                          background: idx % 2 === 1 ? "#f8fafc" : "white",
                        }}
                      >
                        <TableCell
                          className="text-xs font-mono font-medium whitespace-nowrap"
                          style={{ color: "#b45309" }}
                        >
                          {k.styleCode}
                        </TableCell>
                        <TableCell
                          className="text-xs font-medium whitespace-nowrap"
                          style={{ color: "#0f172a" }}
                        >
                          {k.styleName}
                        </TableCell>
                        <TableCell
                          className="text-xs"
                          style={{ color: "#64748b" }}
                        >
                          {k.season}
                        </TableCell>
                        <TableCell>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                            style={{ background: "#fef3c7", color: "#92400e" }}
                          >
                            {k.category}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-10 h-1.5 rounded-full"
                              style={{ background: "#e2e8f0" }}
                            >
                              <div
                                className="h-1.5 rounded-full"
                                style={{
                                  width: `${Math.min(100, (k.ros / 15) * 100)}%`,
                                  background:
                                    k.ros >= 8
                                      ? "#16a34a"
                                      : k.ros >= 4
                                        ? "#d97706"
                                        : "#dc2626",
                                }}
                              />
                            </div>
                            <span
                              className="text-xs font-semibold"
                              style={{ color: "#0f172a" }}
                            >
                              {k.ros.toFixed(1)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-xs"
                          style={{
                            color:
                              k.inventoryCoverWeeks <= 3
                                ? "#dc2626"
                                : "#64748b",
                          }}
                        >
                          {k.inventoryCoverWeeks.toFixed(1)} wks
                        </TableCell>
                        <TableCell
                          className="text-xs"
                          style={{
                            color:
                              k.grossMarginPct >= 50 ? "#16a34a" : "#0f172a",
                          }}
                        >
                          {k.grossMarginPct.toFixed(1)}%
                        </TableCell>
                        <TableCell className="w-36">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={k.buyingScore}
                              className="h-1.5 flex-1"
                              style={
                                {
                                  "--progress-fill":
                                    classColors[k.classification],
                                } as React.CSSProperties
                              }
                            />
                            <span
                              className="text-xs font-bold w-6 text-right"
                              style={{ color: classColors[k.classification] }}
                            >
                              {k.buyingScore}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ClassificationBadge value={k.classification} />
                        </TableCell>
                        <TableCell>
                          <DecisionBadge value={getDecision(k)} />
                        </TableCell>
                        <TableCell>
                          <RiskBadge value={getRisk(k)} />
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <p
                            className="text-xs italic"
                            style={{ color: "#94a3b8" }}
                          >
                            {getRecommendation(k)}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
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
