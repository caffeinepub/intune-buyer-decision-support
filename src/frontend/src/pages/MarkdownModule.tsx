import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Scissors } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { useData } from "../context/DataContext";

function getMarkdown(ros: number, cover: number) {
  if (ros < 4 && cover > 12) return { pct: 30, risk: "High" as const };
  if (ros < 7 && cover > 8) return { pct: 15, risk: "Medium" as const };
  return { pct: 0, risk: "None" as const };
}

export function MarkdownModule() {
  const { filteredKPIs } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterRisk, setFilterRisk] = useState("All");
  const [sortBy, setSortBy] = useState("pct");

  const atRisk = useMemo(() => {
    const withMarkdown = filteredKPIs
      .map((k) => ({
        ...k,
        ...getMarkdown(k.ros4Week ?? k.ros, k.inventoryCoverWeeks),
      }))
      .filter((k) => k.pct > 0);

    // Deduplicate by styleCode — keep the entry with the highest inventoryCoverWeeks (worst case)
    const deduped = new Map<string, (typeof withMarkdown)[number]>();
    for (const item of withMarkdown) {
      const existing = deduped.get(item.styleCode);
      if (
        !existing ||
        item.inventoryCoverWeeks > existing.inventoryCoverWeeks
      ) {
        deduped.set(item.styleCode, item);
      }
    }

    return Array.from(deduped.values());
  }, [filteredKPIs]);

  const filteredAtRisk = useMemo(() => {
    let result = [...atRisk];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (k) =>
          k.styleCode.toLowerCase().includes(q) ||
          (k.styleName ?? "").toLowerCase().includes(q),
      );
    }

    if (filterRisk !== "All") {
      result = result.filter((k) => k.risk === filterRisk);
    }

    if (sortBy === "pct") {
      result.sort((a, b) => b.pct - a.pct);
    } else if (sortBy === "cover") {
      result.sort((a, b) => b.inventoryCoverWeeks - a.inventoryCoverWeeks);
    } else if (sortBy === "ros") {
      result.sort((a, b) => {
        const aRos = a.ros4Week ?? a.ros;
        const bRos = b.ros4Week ?? b.ros;
        return aRos - bRos;
      });
    }

    return result;
  }, [atRisk, searchQuery, filterRisk, sortBy]);

  const totalAtRisk = atRisk.length;
  const avgMarkdownPct =
    totalAtRisk > 0
      ? Math.round(atRisk.reduce((s, k) => s + k.pct, 0) / totalAtRisk)
      : 0;
  // Average stock cover among at-risk styles (meaningful metric vs sum)
  const avgCoverWeeks =
    totalAtRisk > 0
      ? atRisk.reduce((s, k) => s + k.inventoryCoverWeeks, 0) / totalAtRisk
      : 0;

  const kpiCards = [
    {
      label: "Styles at Markdown Risk",
      value: totalAtRisk.toString(),
      sub: "Require price intervention",
      color: "#b91c1c",
      bg: "#fee2e2",
    },
    {
      label: "Avg Recommended Markdown",
      value: `${avgMarkdownPct}%`,
      sub: "Average discount required",
      color: "#b45309",
      bg: "#fef3c7",
    },
    {
      label: "Avg Stock Cover (At-Risk)",
      value: `${avgCoverWeeks.toFixed(1)} wks`,
      sub: "Average weeks of excess inventory",
      color: "#7c3aed",
      bg: "#ede9fe",
    },
  ];

  const controlInputStyle = {
    border: "1.5px solid #e2e8f0",
    color: "#0f172a",
    background: "#f8fafc",
  };

  return (
    <Layout title="Markdown Risk Module">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {kpiCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card
              className="shadow-card border-0"
              data-ocid={`markdown.card.${i + 1}`}
            >
              <CardContent className="pt-5 pb-5">
                <p className="text-xs font-medium" style={{ color: "#64748b" }}>
                  {card.label}
                </p>
                <p
                  className="text-3xl font-bold mt-1"
                  style={{ color: card.color }}
                >
                  {card.value}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                  {card.sub}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search & Filter Controls */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
      >
        <Card className="shadow-card border-0 mb-5">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="flex flex-col gap-1">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "#64748b" }}
                  >
                    Search Style
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search style code or name..."
                    data-ocid="markdown.search_input"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                    style={controlInputStyle}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#f59e0b";
                      e.currentTarget.style.boxShadow = "0 0 0 2px #fde68a";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </label>
              </div>
              <div className="min-w-[160px]">
                <label className="flex flex-col gap-1">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "#64748b" }}
                  >
                    Filter by Risk
                  </span>
                  <select
                    value={filterRisk}
                    onChange={(e) => setFilterRisk(e.target.value)}
                    data-ocid="markdown.select"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none cursor-pointer"
                    style={controlInputStyle}
                  >
                    <option value="All">All Risks</option>
                    <option value="High">High Risk</option>
                    <option value="Medium">Medium Risk</option>
                  </select>
                </label>
              </div>
              <div className="min-w-[220px]">
                <label className="flex flex-col gap-1">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "#64748b" }}
                  >
                    Sort by Priority
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    data-ocid="markdown.select"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none cursor-pointer"
                    style={controlInputStyle}
                  >
                    <option value="pct">Markdown % (High → Low)</option>
                    <option value="cover">Stock Cover (High → Low)</option>
                    <option value="ros">
                      4W ROS (Low → High — worst first)
                    </option>
                  </select>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
      >
        <Card className="shadow-card border-0 mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle
                className="text-sm font-semibold flex items-center gap-2"
                style={{ color: "#0f172a" }}
              >
                <Scissors className="w-4 h-4" style={{ color: "#b45309" }} />
                Styles Requiring Markdown Action
              </CardTitle>
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: "#fef3c7", color: "#92400e" }}
              >
                Showing {filteredAtRisk.length} of {totalAtRisk} styles at
                markdown risk
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {atRisk.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16 text-center"
                data-ocid="markdown.empty_state"
              >
                <AlertTriangle
                  className="w-10 h-10 mb-3"
                  style={{ color: "#94a3b8" }}
                />
                <p className="text-sm font-medium" style={{ color: "#0f172a" }}>
                  No styles at markdown risk
                </p>
                <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
                  All styles have acceptable ROS and stock levels.
                </p>
              </div>
            ) : filteredAtRisk.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 text-center"
                data-ocid="markdown.empty_state"
              >
                <AlertTriangle
                  className="w-8 h-8 mb-2"
                  style={{ color: "#94a3b8" }}
                />
                <p className="text-sm font-medium" style={{ color: "#0f172a" }}>
                  No results match your search/filter
                </p>
                <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
                  Try adjusting your search or filter.
                </p>
              </div>
            ) : (
              <div className="overflow-auto">
                <Table data-ocid="markdown.table">
                  <TableHeader>
                    <TableRow style={{ background: "#f8fafc" }}>
                      {[
                        "Priority",
                        "Style Code",
                        "Style Name",
                        "Category",
                        "4W ROS",
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
                    {filteredAtRisk.map((k, idx) => {
                      const isUrgent = k.risk === "High" && k.pct === 30;
                      const ros4w = k.ros4Week ?? k.ros;
                      return (
                        <TableRow
                          key={k.styleCode}
                          data-ocid={`markdown.item.${idx + 1}`}
                          style={{
                            background: idx % 2 === 1 ? "#f8fafc" : "white",
                          }}
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
                            className="text-xs font-bold"
                            style={{ color: "#0f172a" }}
                          >
                            {k.styleCode}
                          </TableCell>
                          <TableCell
                            className="text-xs"
                            style={{ color: "#334155" }}
                          >
                            {k.styleName}
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
                            {ros4w.toFixed(1)}
                          </TableCell>
                          <TableCell
                            className="text-xs"
                            style={{ color: "#64748b" }}
                          >
                            {k.inventoryCoverWeeks.toFixed(1)}
                          </TableCell>
                          <TableCell>
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                background:
                                  k.risk === "High" ? "#fee2e2" : "#fef3c7",
                                color:
                                  k.risk === "High" ? "#b91c1c" : "#b45309",
                              }}
                            >
                              {k.risk}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className="text-xs font-bold px-2.5 py-1 rounded-full"
                              style={{
                                background:
                                  k.pct === 30 ? "#b91c1c" : "#d97706",
                                color: "white",
                              }}
                            >
                              {k.pct}%
                            </span>
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

      {/* Decision Rules Reference */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card
          className="shadow-card border-0"
          style={{ border: "1px solid #fde68a" }}
        >
          <CardHeader className="pb-3">
            <CardTitle
              className="text-sm font-semibold"
              style={{ color: "#92400e" }}
            >
              Markdown Decision Rules — Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "#fef3c7" }}>
                  <th
                    className="text-left px-4 py-2 font-semibold"
                    style={{ color: "#92400e" }}
                  >
                    Condition
                  </th>
                  <th
                    className="text-left px-4 py-2 font-semibold"
                    style={{ color: "#92400e" }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    condition: "Low ROS (<4) + High Stock (>12 wks)",
                    action: "30% discount — Clearance required",
                  },
                  {
                    condition: "Medium ROS (4–7) + High Stock (>8 wks)",
                    action: "10–20% discount — Stimulate sell-through",
                  },
                  {
                    condition: "High ROS (≥7) — Strong performer",
                    action: "No markdown needed — Focus on replenishment",
                  },
                ].map((row, i) => (
                  <tr
                    key={row.condition}
                    style={{ background: i % 2 === 1 ? "#fffbeb" : "white" }}
                  >
                    <td
                      className="px-4 py-2.5 font-medium"
                      style={{ color: "#334155" }}
                    >
                      {row.condition}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "#64748b" }}>
                      {row.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </motion.div>
    </Layout>
  );
}
