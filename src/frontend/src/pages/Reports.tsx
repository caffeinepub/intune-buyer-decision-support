import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";
import { motion } from "motion/react";
import { ClassificationBadge } from "../components/ClassificationBadge";
import { Layout } from "../components/Layout";
import { useData } from "../context/DataContext";

function exportCSV(data: ReturnType<typeof useData>["filteredKPIs"]) {
  const headers = [
    "Style Code",
    "Style Name",
    "Season",
    "Category",
    "ROS",
    "Inv Cover (wks)",
    "GM%",
    "Buying Score",
    "Classification",
  ];
  const rows = data.map((k) => [
    k.styleCode,
    k.styleName,
    k.season,
    k.category,
    k.ros.toFixed(1),
    k.inventoryCoverWeeks.toFixed(1),
    k.grossMarginPct.toFixed(1),
    k.buyingScore,
    k.classification,
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${v}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "intune-rebuy-report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function Reports() {
  const { filteredKPIs } = useData();

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

  return (
    <Layout title="Reports & Data Export">
      {/* Summary stats */}
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

      <Card className="shadow-card border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle
              className="text-sm font-semibold"
              style={{ color: "#0f172a" }}
            >
              Full Style Report
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => exportCSV(filteredKPIs)}
              data-ocid="reports.export.button"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredKPIs.length === 0 ? (
            <div
              className="py-12 text-center text-sm"
              style={{ color: "#94a3b8" }}
              data-ocid="reports.empty_state"
            >
              No styles match the current filters.
            </div>
          ) : (
            <Table data-ocid="reports.table">
              <TableHeader>
                <TableRow style={{ background: "#f8fafc" }}>
                  <TableHead
                    className="text-xs font-semibold"
                    style={{ color: "#64748b" }}
                  >
                    Style Code
                  </TableHead>
                  <TableHead
                    className="text-xs font-semibold"
                    style={{ color: "#64748b" }}
                  >
                    Style Name
                  </TableHead>
                  <TableHead
                    className="text-xs font-semibold"
                    style={{ color: "#64748b" }}
                  >
                    Season
                  </TableHead>
                  <TableHead
                    className="text-xs font-semibold"
                    style={{ color: "#64748b" }}
                  >
                    Category
                  </TableHead>
                  <TableHead
                    className="text-xs font-semibold"
                    style={{ color: "#64748b" }}
                  >
                    ROS
                  </TableHead>
                  <TableHead
                    className="text-xs font-semibold"
                    style={{ color: "#64748b" }}
                  >
                    Inv Cover
                  </TableHead>
                  <TableHead
                    className="text-xs font-semibold"
                    style={{ color: "#64748b" }}
                  >
                    GM%
                  </TableHead>
                  <TableHead
                    className="text-xs font-semibold"
                    style={{ color: "#64748b" }}
                  >
                    Score
                  </TableHead>
                  <TableHead
                    className="text-xs font-semibold"
                    style={{ color: "#64748b" }}
                  >
                    Classification
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKPIs.map((k, idx) => (
                  <TableRow
                    key={k.styleCode}
                    data-ocid={`reports.item.${idx + 1}`}
                    style={{ background: idx % 2 === 1 ? "#f8fafc" : "white" }}
                  >
                    <TableCell
                      className="text-xs font-mono font-medium"
                      style={{ color: "#4f46e5" }}
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
                    <TableCell
                      className="text-xs font-semibold"
                      style={{ color: "#0f172a" }}
                    >
                      {k.ros.toFixed(1)}
                    </TableCell>
                    <TableCell
                      className="text-xs"
                      style={{
                        color:
                          k.inventoryCoverWeeks <= 3 ? "#dc2626" : "#64748b",
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
                    <TableCell>
                      <ClassificationBadge value={k.classification} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
