import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useData } from "../context/DataContext";
import { parseExcelFile } from "../utils/excelParser";

const UPLOAD_TOAST_ID = "upload-summary";

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const { filters, setFilters, seasons, categories, setData } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const parsed = await parseExcelFile(file);
      setData(parsed);

      const s = parsed.analysisSummary;
      if (s) {
        toast.custom(
          () => (
            <div
              className="rounded-xl shadow-lg border p-4 max-w-sm w-full relative"
              style={{ background: "white", borderColor: "#e2e8f0" }}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => toast.dismiss(UPLOAD_TOAST_ID)}
                className="absolute top-3 right-3 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
                style={{ color: "#94a3b8", width: "20px", height: "20px" }}
                aria-label="Dismiss"
                data-ocid="upload_summary.close_button"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3 pr-5">
                <CheckCircle
                  className="w-5 h-5 mt-0.5 shrink-0"
                  style={{ color: "#16a34a" }}
                />
                <div className="space-y-1">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "#0f172a" }}
                  >
                    File analysed — {s.totalStyles} styles loaded
                  </p>
                  <p className="text-xs" style={{ color: "#64748b" }}>
                    {s.sheetsDetected.length} sheet(s) detected:{" "}
                    <span className="font-medium">
                      {s.sheetsDetected.join(", ")}
                    </span>
                  </p>
                  <p className="text-xs" style={{ color: "#64748b" }}>
                    Seasons:{" "}
                    <span className="font-medium">
                      {s.seasonsFound.join(", ") || "—"}
                    </span>
                  </p>
                  <p className="text-xs" style={{ color: "#64748b" }}>
                    Categories:{" "}
                    <span className="font-medium">
                      {s.categoriesFound.join(", ") || "—"}
                    </span>
                  </p>
                  <p className="text-xs" style={{ color: "#64748b" }}>
                    Scoring:{" "}
                    <span className="font-medium">
                      {s.scoringMethod === "from_file"
                        ? "read from file"
                        : "auto-computed from sales data"}
                    </span>
                  </p>
                  <div className="flex gap-3 pt-1 text-xs font-semibold">
                    <span style={{ color: "#16a34a" }}>
                      ✓ {s.rebuyCount} Re-buy
                    </span>
                    <span style={{ color: "#d97706" }}>
                      ~ {s.monitorCount} Monitor
                    </span>
                    <span style={{ color: "#dc2626" }}>
                      ✗ {s.doNotRebuyCount} Do Not
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ),
          { id: UPLOAD_TOAST_ID, duration: 8000 },
        );
      } else {
        toast.success("Excel file uploaded and data refreshed!");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to parse Excel file: ${msg}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b"
      style={{ background: "white", borderColor: "#e2e8f0" }}
    >
      <h1 className="text-lg font-bold" style={{ color: "#0f172a" }}>
        {title}
      </h1>

      <div className="flex items-center gap-3">
        {/* Season filter */}
        <Select
          value={filters.season}
          onValueChange={(v) => setFilters({ ...filters, season: v })}
        >
          <SelectTrigger
            className="w-32 h-8 text-xs"
            data-ocid="filter.season.select"
          >
            <SelectValue placeholder="Season" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Seasons</SelectItem>
            {seasons.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category filter */}
        <Select
          value={filters.category}
          onValueChange={(v) => setFilters({ ...filters, category: v })}
        >
          <SelectTrigger
            className="w-32 h-8 text-xs"
            data-ocid="filter.category.select"
          >
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Upload button */}
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5"
          style={{ background: "oklch(0.82 0.18 88)", color: "#1a1a1a" }}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          data-ocid="topbar.upload_button"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {uploading ? "Analysing..." : "Upload Excel"}
        </Button>
      </div>
    </header>
  );
}
