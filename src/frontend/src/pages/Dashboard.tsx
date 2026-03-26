import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  BarChart2,
  Layers,
  Lightbulb,
  Package,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
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

const RISK_COLORS = {
  "Overstock Risk": "#dc2626",
  Medium: "#d97706",
  "Stockout Risk": "#f97316",
};

export function Dashboard() {
  const { filteredKPIs } = useData();

  const metrics = useMemo(() => {
    const total = filteredKPIs.length;
    const rebuyItems = filteredKPIs.filter(
      (k) => k.classification === "Re-buy Candidate",
    );
    const exitItems = filteredKPIs.filter(
      (k) => k.classification === "Do Not Re-buy",
    );
    const rebuyCount = rebuyItems.length;
    const exitCount = exitItems.length;
    const rebuyPct = total > 0 ? Math.round((rebuyCount / total) * 100) : 0;
    const exitPct = total > 0 ? Math.round((exitCount / total) * 100) : 0;
    const totalRebuyQty = rebuyCount * 50;
    const avgRos =
      total > 0 ? filteredKPIs.reduce((s, k) => s + k.ros, 0) / total : 0;

    // Zone performance — sorted by count
    const cats = Array.from(new Set(filteredKPIs.map((k) => k.category)));
    const zoneData = cats
      .map((cat) => {
        const items = filteredKPIs.filter((k) => k.category === cat);
        return {
          zone: cat,
          count: items.length,
        };
      })
      .sort((a, b) => b.count - a.count);

    const topZone = zoneData[0];

    // Stock risk
    const highRisk = filteredKPIs.filter(
      (k) => k.inventoryCoverWeeks > 12,
    ).length;
    const mediumRisk = filteredKPIs.filter(
      (k) => k.inventoryCoverWeeks >= 6 && k.inventoryCoverWeeks <= 12,
    ).length;
    const safeRisk = filteredKPIs.filter(
      (k) => k.inventoryCoverWeeks < 6,
    ).length;
    const riskData = [
      {
        name: "Overstock Risk",
        value: highRisk,
        pct: total > 0 ? Math.round((highRisk / total) * 100) : 0,
      },
      {
        name: "Medium",
        value: mediumRisk,
        pct: total > 0 ? Math.round((mediumRisk / total) * 100) : 0,
      },
      {
        name: "Stockout Risk",
        value: safeRisk,
        pct: total > 0 ? Math.round((safeRisk / total) * 100) : 0,
      },
    ];

    // Insights
    const rebuyQualifyCount = rebuyItems.filter(
      (k) => k.buyingScore >= 70,
    ).length;
    const topZoneRebuyItems = topZone
      ? filteredKPIs.filter(
          (k) =>
            k.category === topZone.zone &&
            k.classification === "Re-buy Candidate",
        ).length
      : 0;
    const topZoneRebuyPct =
      rebuyCount > 0 ? Math.round((topZoneRebuyItems / rebuyCount) * 100) : 0;
    const overstockedPct =
      total > 0
        ? Math.round(
            (filteredKPIs.filter((k) => k.inventoryCoverWeeks > 10).length /
              total) *
              100,
          )
        : 0;
    const rebuyQualifyPct =
      total > 0 ? Math.round((rebuyQualifyCount / total) * 100) : 0;

    const insights: string[] = [];
    if (topZone) {
      insights.push(
        `${topZone.zone} zone has the highest style count (${topZone.count} styles), contributing to ${topZoneRebuyPct}% of rebuy recommendations.`,
      );
    }
    insights.push(
      `${overstockedPct}% of styles have high stock cover (>10 weeks) and may require markdown intervention.`,
    );
    insights.push(
      `${rebuyQualifyPct}% of styles qualify for rebuy based on score and velocity.`,
    );

    return {
      total,
      rebuyPct,
      exitPct,
      rebuyCount,
      totalRebuyQty,
      avgRos,
      zoneData,
      riskData,
      insights,
    };
  }, [filteredKPIs]);

  const kpiCards = [
    {
      label: "Total Styles Analyzed",
      value: metrics.total.toLocaleString(),
      icon: Layers,
      color: "#b45309",
      bg: "#fef3c7",
      sub: "All uploaded styles",
    },
    {
      label: "Styles for Rebuy",
      value: `${metrics.rebuyPct}%`,
      icon: TrendingUp,
      color: "#16a34a",
      bg: "#dcfce7",
      sub: `${metrics.rebuyCount} styles recommended`,
    },
    {
      label: "Styles to Exit",
      value: `${metrics.exitPct}%`,
      icon: XCircle,
      color: "#dc2626",
      bg: "#fee2e2",
      sub: "Do Not Re-buy classification",
    },
    {
      label: "Total Rebuy Qty",
      value: metrics.totalRebuyQty.toLocaleString(),
      icon: Package,
      color: "#7c3aed",
      bg: "#ede9fe",
      sub: "Estimated units",
    },
    {
      label: "Avg ROS",
      value: `${metrics.avgRos.toFixed(1)}`,
      icon: BarChart2,
      color: "#0369a1",
      bg: "#e0f2fe",
      sub: "Overall average ROS",
    },
  ];

  return (
    <Layout title="Dashboard Overview">
      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {kpiCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <Card
              className="shadow-card border-0"
              data-ocid={`dashboard.card.${i + 1}`}
            >
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-2">
                    <p
                      className="text-xs font-medium leading-tight"
                      style={{ color: "#64748b" }}
                    >
                      {card.label}
                    </p>
                    <p
                      className="text-2xl font-bold mt-1"
                      style={{ color: "#0f172a" }}
                    >
                      {card.value}
                    </p>
                    <p
                      className="text-xs mt-0.5 truncate"
                      style={{ color: "#94a3b8" }}
                    >
                      {card.sub}
                    </p>
                  </div>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: card.bg }}
                  >
                    <card.icon
                      className="w-5 h-5"
                      style={{ color: card.color }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row — 2 columns */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        {/* Zone Performance */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
        >
          <Card
            className="shadow-card border-0 h-full"
            data-ocid="dashboard.zone.card"
          >
            <CardHeader className="pb-2">
              <CardTitle
                className="text-sm font-semibold"
                style={{ color: "#0f172a" }}
              >
                Zone Performance – Style Count
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.zoneData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={metrics.zoneData} barSize={36}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="zone"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(val: number) => [`${val}`, "Styles"]}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {metrics.zoneData.map((d, i) => (
                        <Cell
                          key={d.zone}
                          fill={i === 0 ? "#b45309" : "#94a3b8"}
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
            </CardContent>
          </Card>
        </motion.div>

        {/* Stock Risk Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card
            className="shadow-card border-0 h-full"
            data-ocid="dashboard.risk.card"
          >
            <CardHeader className="pb-2">
              <CardTitle
                className="text-sm font-semibold"
                style={{ color: "#0f172a" }}
              >
                Stock Risk Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mt-2">
                {metrics.riskData.map((r) => (
                  <div key={r.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-xs font-medium"
                        style={{ color: "#0f172a" }}
                      >
                        {r.name}
                      </span>
                      <span
                        className="text-xs font-bold"
                        style={{
                          color:
                            RISK_COLORS[r.name as keyof typeof RISK_COLORS] ??
                            "#64748b",
                        }}
                      >
                        {r.pct}%
                      </span>
                    </div>
                    <div
                      className="h-2.5 rounded-full"
                      style={{ background: "#f1f5f9" }}
                    >
                      <div
                        className="h-2.5 rounded-full transition-all"
                        style={{
                          width: `${r.pct}%`,
                          background:
                            RISK_COLORS[r.name as keyof typeof RISK_COLORS] ??
                            "#94a3b8",
                        }}
                      />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                      {r.value} styles
                    </p>
                  </div>
                ))}
              </div>
              <div
                className="mt-4 pt-3"
                style={{ borderTop: "1px solid #f1f5f9" }}
              >
                <p className="text-xs" style={{ color: "#64748b" }}>
                  <span style={{ color: "#dc2626", fontWeight: 600 }}>
                    Overstock Risk
                  </span>
                  : cover &gt;12 wks ·{" "}
                  <span style={{ color: "#d97706", fontWeight: 600 }}>
                    Medium
                  </span>
                  : 6–12 wks ·{" "}
                  <span style={{ color: "#f97316", fontWeight: 600 }}>
                    Stockout Risk
                  </span>
                  : &lt;6 wks
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Insights Box */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card
          className="border-0"
          data-ocid="dashboard.insights.card"
          style={{ background: "#0f172a", borderLeft: "4px solid #f59e0b" }}
        >
          <CardHeader className="pb-3">
            <CardTitle
              className="text-sm font-semibold flex items-center gap-2"
              style={{ color: "#fbbf24" }}
            >
              <Lightbulb className="w-4 h-4" style={{ color: "#f59e0b" }} />
              Strategic Insights — Action Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {metrics.insights.map((insight, i) => {
                const actions = [
                  "→ Prioritize this zone for rebuy",
                  "→ Action required: initiate markdown review",
                  "→ Fast-track rebuy orders",
                ];
                return (
                  <li key={insight} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ background: "#f59e0b", color: "#0f172a" }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: "#e2e8f0" }}
                      >
                        {insight}
                      </p>
                      <p
                        className="text-xs mt-1 font-semibold"
                        style={{ color: "#fbbf24" }}
                      >
                        {actions[i % actions.length]}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </Layout>
  );
}
