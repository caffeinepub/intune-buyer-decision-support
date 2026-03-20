// xlsx loaded via CDN in index.html
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const XLSX: any;
import type {
  AnalysisSummary,
  AppData,
  KPIResult,
  SizeAllocation,
  SupplyChainResult,
  VelocityProfile,
} from "../types";

type Row = Record<string, unknown>;

function toNum(v: unknown): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number.parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string {
  return String(v ?? "").trim();
}

// Fuzzy column finder: tries exact match first, then case-insensitive, then partial
function findCol(headers: string[], ...candidates: string[]): string | null {
  for (const c of candidates) {
    const exact = headers.find((h) => h === c);
    if (exact) return exact;
  }
  for (const c of candidates) {
    const ci = headers.find((h) => h.toLowerCase() === c.toLowerCase());
    if (ci) return ci;
  }
  for (const c of candidates) {
    const partial = headers.find((h) =>
      h.toLowerCase().includes(c.toLowerCase()),
    );
    if (partial) return partial;
  }
  return null;
}

function getVal(row: Row, col: string | null): unknown {
  if (!col) return undefined;
  return row[col];
}

function sheetToRows(wb: any, index: number): Row[] {
  if (index >= wb.SheetNames.length) return [];
  const sheet = wb.Sheets[wb.SheetNames[index]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

// Compute buying score from metrics when not present in file
function computeScore(
  ros: number,
  invCover: number,
  gm: number,
  allRos: number[],
  allInv: number[],
  allGm: number[],
): number {
  const maxRos = Math.max(...allRos, 1);
  const maxInv = Math.max(...allInv, 1);
  const maxGm = Math.max(...allGm, 1);
  // Higher ROS = better, lower inv cover = better (stock running out = demand), higher GM = better
  const rosScore = Math.min(100, (ros / maxRos) * 100);
  const invScore =
    invCover > 0 ? Math.max(0, 100 - (invCover / maxInv) * 100) : 50;
  const gmScore = Math.min(100, (gm / maxGm) * 100);
  return Math.round(rosScore * 0.4 + invScore * 0.35 + gmScore * 0.25);
}

function classifyScore(score: number): KPIResult["classification"] {
  if (score >= 70) return "Re-buy Candidate";
  if (score < 40) return "Do Not Re-buy";
  return "Monitor";
}

function velocityFromRos(ros: number, allRos: number[]): VelocityProfile {
  const sorted = [...allRos].sort((a, b) => a - b);
  const p33 = sorted[Math.floor(sorted.length * 0.33)] ?? 0;
  const p66 = sorted[Math.floor(sorted.length * 0.66)] ?? 0;
  if (ros >= p66) return "Fast";
  if (ros >= p33) return "Medium";
  return "Slow";
}

export async function parseExcelFile(file: File): Promise<AppData> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  const sheetsDetected: string[] = wb.SheetNames;

  // ---- Sheet 1: Styles master / KPI data ----
  const stylesRows = sheetToRows(wb, 0);
  if (stylesRows.length === 0) throw new Error("Sheet 1 is empty");

  const headers1 = Object.keys(stylesRows[0]);

  const colStyleCode = findCol(
    headers1,
    "Style Code",
    "StyleCode",
    "style_code",
    "STYLE CODE",
    "Barcode",
    "SKU",
    "Code",
  );
  const colStyleName = findCol(
    headers1,
    "Style Name",
    "StyleName",
    "style_name",
    "STYLE NAME",
    "Description",
    "Name",
    "Article",
  );
  const colSeason = findCol(headers1, "Season", "SEASON", "season");
  const colCategory = findCol(
    headers1,
    "Category",
    "CATEGORY",
    "category",
    "Dept",
    "Department",
    "Class",
  );
  const colBuyingScore = findCol(
    headers1,
    "Buying Score",
    "BUYING SCORE",
    "buyingScore",
    "buying_score",
    "Score",
    "SCORE",
  );
  const colRebuyDecision = findCol(
    headers1,
    "Re-buy Decision",
    "REBUY DECISION",
    "RE-BUY DECISION",
    "Decision",
    "DECISION",
    "Rebuy",
  );
  const colROS = findCol(
    headers1,
    "ROS",
    "ros",
    "Rate of Sale",
    "RATE OF SALE",
    "Weekly Sales",
    "Wkly Sales",
    "Sales Rate",
  );
  const colInvCover = findCol(
    headers1,
    "Inv Cover",
    "INV COVER",
    "Inventory Cover",
    "Cover Weeks",
    "Stock Cover",
    "Wks Cover",
  );
  const colGM = findCol(
    headers1,
    "GM%",
    "GM %",
    "Gross Margin",
    "GROSS MARGIN",
    "grossMargin",
    "Margin %",
    "GP%",
    "GP %",
  );
  const _colQty = findCol(
    headers1,
    "Qty",
    "QTY",
    "Quantity",
    "QUANTITY",
    "Total Qty",
    "Opening Stock",
    "Curr Stock",
  );

  // ---- Sheet 2: Sales data (optional) ----
  const salesRows = sheetToRows(wb, 1);
  // Build styleCode -> total sales qty map
  const salesMap: Record<string, number> = {};
  if (salesRows.length > 0) {
    const sh2 = Object.keys(salesRows[0]);
    const sc2 = findCol(
      sh2,
      "Style Code",
      "StyleCode",
      "style_code",
      "STYLE CODE",
      "Code",
      "SKU",
      "Barcode",
    );
    const sq2 = findCol(
      sh2,
      "Qty",
      "QTY",
      "Sales Qty",
      "Units Sold",
      "Sale Qty",
      "UNITS",
      "QUANTITY",
      "Net Qty",
      "Net Sales Qty",
    );
    const swk2 = findCol(sh2, "Week", "WEEK", "Wk", "WK", "Period");
    if (sc2 && sq2) {
      for (const r of salesRows) {
        const code = toStr(getVal(r, sc2));
        if (!code) continue;
        salesMap[code] = (salesMap[code] ?? 0) + toNum(getVal(r, sq2));
      }
      // Detect number of weeks in sales data for ROS computation
      if (swk2) {
        const uniqueWeeks = new Set(
          salesRows.map((r) => toStr(getVal(r, swk2))),
        ).size;
        if (uniqueWeeks > 1) {
          for (const code of Object.keys(salesMap)) {
            salesMap[code] = salesMap[code] / uniqueWeeks;
          }
        }
      }
    }
  }

  // ---- Sheet 3: Inventory data (optional) ----
  const inventoryRows = sheetToRows(wb, 2);
  const inventoryMap: Record<string, number> = {}; // styleCode -> current stock qty
  if (inventoryRows.length > 0) {
    const sh3 = Object.keys(inventoryRows[0]);
    const sc3 = findCol(
      sh3,
      "Style Code",
      "StyleCode",
      "style_code",
      "STYLE CODE",
      "Code",
      "SKU",
    );
    const si3 = findCol(
      sh3,
      "Qty",
      "QTY",
      "Stock Qty",
      "Closing Stock",
      "Current Stock",
      "Inventory",
      "On Hand",
      "SOH",
    );
    if (sc3 && si3) {
      for (const r of inventoryRows) {
        const code = toStr(getVal(r, sc3));
        if (!code) continue;
        inventoryMap[code] = (inventoryMap[code] ?? 0) + toNum(getVal(r, si3));
      }
    }
  }

  // ---- Sheet 4: Size data (optional) ----
  const sizeRows = sheetToRows(wb, 3);
  const sizeDataMap: Record<string, SizeAllocation[]> = {};
  if (sizeRows.length > 0) {
    const sh4 = Object.keys(sizeRows[0]);
    const sc4 = findCol(
      sh4,
      "Style Code",
      "StyleCode",
      "style_code",
      "STYLE CODE",
      "Code",
      "SKU",
    );
    const ss4 = findCol(sh4, "Size", "SIZE", "size", "Size Code", "Size Name");
    const sq4 = findCol(
      sh4,
      "Qty",
      "QTY",
      "Quantity",
      "QUANTITY",
      "Sales Qty",
      "Units",
      "Net Qty",
    );
    if (sc4 && ss4 && sq4) {
      // Group by style code
      const sizeGroups: Record<string, Record<string, number>> = {};
      for (const r of sizeRows) {
        const code = toStr(getVal(r, sc4));
        const size = toStr(getVal(r, ss4));
        const qty = toNum(getVal(r, sq4));
        if (!code || !size) continue;
        if (!sizeGroups[code]) sizeGroups[code] = {};
        sizeGroups[code][size] = (sizeGroups[code][size] ?? 0) + qty;
      }
      for (const [code, sizes] of Object.entries(sizeGroups)) {
        const totalQty = Object.values(sizes).reduce((a, b) => a + b, 0);
        if (totalQty === 0) continue;
        sizeDataMap[code] = Object.entries(sizes)
          .sort((a, b) => {
            const sizeOrder = [
              "XS",
              "S",
              "M",
              "L",
              "XL",
              "XXL",
              "XXXL",
              "28",
              "30",
              "32",
              "34",
              "36",
              "38",
              "40",
              "42",
              "44",
              "46",
            ];
            const ai = sizeOrder.indexOf(a[0]);
            const bi = sizeOrder.indexOf(b[0]);
            if (ai >= 0 && bi >= 0) return ai - bi;
            if (ai >= 0) return -1;
            if (bi >= 0) return 1;
            return a[0].localeCompare(b[0]);
          })
          .map(([size, qty]) => ({
            size,
            ratioPart: qty,
            sizeContributionPct: Math.round((qty / totalQty) * 100),
            suggestedRebuyQty: 0, // Will be updated when user inputs total qty
          }));
      }
    }
  }

  // ---- Build KPI records from Sheet 1 ----
  const allRosVals: number[] = [];
  const allInvVals: number[] = [];
  const allGmVals: number[] = [];

  // First pass: collect raw values
  const rawKpis = stylesRows.map((r) => {
    const code = toStr(getVal(r, colStyleCode));
    const rosFromSheet = colROS ? toNum(getVal(r, colROS)) : 0;
    const rosFromSales = salesMap[code] ?? 0;
    const ros = rosFromSheet > 0 ? rosFromSheet : rosFromSales;

    const invFromSheet = colInvCover ? toNum(getVal(r, colInvCover)) : 0;
    const invFromInventory = inventoryMap[code] ?? 0;
    let invCover = invFromSheet;
    if (invCover === 0 && invFromInventory > 0 && ros > 0) {
      invCover = invFromInventory / ros;
    }

    const gm = colGM ? toNum(getVal(r, colGM)) : 0;

    allRosVals.push(ros);
    allInvVals.push(invCover);
    allGmVals.push(gm);

    return { r, code, ros, invCover, gm };
  });

  // Detect if buying score is available in the file
  const hasScoreCol = !!colBuyingScore;
  const hasDecisionCol = !!colRebuyDecision;
  const scoringMethod: AnalysisSummary["scoringMethod"] = hasScoreCol
    ? "from_file"
    : "computed";

  // Second pass: build final KPI objects
  const kpis: KPIResult[] = rawKpis
    .map(({ r, code, ros, invCover, gm }) => {
      let buyingScore: number;
      let classification: KPIResult["classification"];

      if (hasScoreCol) {
        buyingScore = Math.round(toNum(getVal(r, colBuyingScore)));
        if (buyingScore > 100) buyingScore = Math.round(buyingScore / 10); // Handle 0-1000 scale
      } else {
        buyingScore = computeScore(
          ros,
          invCover,
          gm,
          allRosVals,
          allInvVals,
          allGmVals,
        );
      }

      if (hasDecisionCol) {
        const dec = toStr(getVal(r, colRebuyDecision)).toLowerCase();
        if (
          dec.includes("re-buy") ||
          dec.includes("rebuy") ||
          dec.includes("yes")
        ) {
          classification = "Re-buy Candidate";
        } else if (dec.includes("monitor") || dec.includes("watch")) {
          classification = "Monitor";
        } else if (
          dec.includes("no") ||
          dec.includes("don") ||
          dec.includes("not")
        ) {
          classification = "Do Not Re-buy";
        } else {
          classification = classifyScore(buyingScore);
        }
      } else {
        classification = classifyScore(buyingScore);
      }

      // Capture additional raw fields from the row
      const rawFields: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === "number" || typeof v === "string") {
          rawFields[k] = v;
        }
      }

      return {
        styleCode:
          code ||
          `STYLE-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        styleName: toStr(getVal(r, colStyleName)) || code,
        season: (toStr(getVal(r, colSeason)) || "Unknown") as string,
        category: (toStr(getVal(r, colCategory)) || "Uncategorised") as string,
        ros,
        inventoryCoverWeeks: invCover,
        grossMarginPct: gm,
        buyingScore: Math.min(100, Math.max(0, buyingScore)),
        classification,
        rawFields,
      };
    })
    .filter((k) => k.styleCode !== "");

  // ---- Build supply chain records from computed data ----
  const allRosForVelocity = kpis.map((k) => k.ros);
  const supplyChain: SupplyChainResult[] = kpis.map((k) => {
    const velocity = velocityFromRos(k.ros, allRosForVelocity);
    const stabilityScore = Math.min(
      100,
      Math.round(
        k.buyingScore * 0.7 +
          (velocity === "Fast" ? 30 : velocity === "Medium" ? 15 : 0),
      ),
    );
    const runwayWeeks =
      k.inventoryCoverWeeks > 0 ? Math.round(k.inventoryCoverWeeks) : 4;
    const leadTime = velocity === "Fast" ? 21 : velocity === "Medium" ? 28 : 42;

    let decision: SupplyChainResult["decision"];
    if (k.classification === "Re-buy Candidate") {
      decision = "Immediate Re-buy Required";
    } else if (k.classification === "Monitor") {
      decision = "Monitor Performance";
    } else {
      decision = "Do Not Re-buy";
    }

    return {
      styleCode: k.styleCode,
      styleName: k.styleName,
      season: k.season,
      vendorLeadTimeDays: leadTime,
      seasonRunwayWeeks: runwayWeeks,
      salesStabilityScore: stabilityScore,
      velocityProfile: velocity,
      decision,
    };
  });

  // ---- Build analysis summary ----
  const categories = Array.from(
    new Set(kpis.map((k) => k.category).filter(Boolean)),
  );
  const seasons = Array.from(
    new Set(kpis.map((k) => k.season).filter(Boolean)),
  );
  const rebuyCount = kpis.filter(
    (k) => k.classification === "Re-buy Candidate",
  ).length;
  const monitorCount = kpis.filter(
    (k) => k.classification === "Monitor",
  ).length;
  const doNotRebuyCount = kpis.filter(
    (k) => k.classification === "Do Not Re-buy",
  ).length;

  const detectedCols = [
    colStyleCode && "Style Code",
    colStyleName && "Style Name",
    colSeason && "Season",
    colCategory && "Category",
    colBuyingScore && "Buying Score",
    colRebuyDecision && "Re-buy Decision",
    colROS && "ROS",
    colInvCover && "Inv Cover",
    colGM && "GM%",
    salesRows.length > 0 && "Sales (Sheet 2)",
    inventoryRows.length > 0 && "Inventory (Sheet 3)",
    sizeRows.length > 0 && "Sizes (Sheet 4)",
  ].filter(Boolean) as string[];

  const analysisSummary: AnalysisSummary = {
    totalStyles: kpis.length,
    sheetsDetected,
    columnsDetected: detectedCols,
    categoriesFound: categories,
    seasonsFound: seasons,
    scoringMethod,
    rebuyCount,
    monitorCount,
    doNotRebuyCount,
  };

  return {
    kpis,
    supplyChain,
    sizeData: sizeDataMap,
    analysisSummary,
  };
}
