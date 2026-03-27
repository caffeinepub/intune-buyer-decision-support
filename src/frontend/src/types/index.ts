export type Classification = "Re-buy Candidate" | "Monitor" | "Do Not Re-buy";
export type Season = string;
export type Category = string;
export type VelocityProfile = "Fast" | "Medium" | "Slow";

export interface StyleRecord {
  styleCode: string;
  styleName: string;
  season: Season;
  category: Category;
  vendor: string;
}

export interface KPIResult {
  styleCode: string;
  styleName: string;
  season: Season;
  category: Category;
  vendor: string;
  ros: number; // Rate of Sale (units/week)
  ros4Week: number; // 4-week ROS from Excel (falls back to ros if not present)
  inventoryCoverWeeks: number;
  grossMarginPct: number;
  buyingScore: number; // 0-100
  classification: Classification;
  // Additional raw fields captured from upload
  rawFields?: Record<string, string | number>;
}

export interface SupplyChainResult {
  styleCode: string;
  styleName: string;
  season: Season;
  vendor: string;
  vendorLeadTimeDays: number;
  seasonRunwayWeeks: number;
  velocityProfile: VelocityProfile;
  decision:
    | "Immediate Re-buy Required"
    | "Monitor Performance"
    | "Do Not Re-buy";
}

export interface SizeAllocation {
  size: string;
  ratioPart: number;
  sizeContributionPct: number;
  suggestedRebuyQty: number;
}

export interface AnalysisSummary {
  totalStyles: number;
  sheetsDetected: string[];
  columnsDetected: string[];
  categoriesFound: string[];
  seasonsFound: string[];
  scoringMethod: "from_file" | "computed";
  rebuyCount: number;
  monitorCount: number;
  doNotRebuyCount: number;
}

export interface DashboardSummary {
  totalStyles: number;
  rebuyCount: number;
  monitorCount: number;
  doNotRebuyCount: number;
  topCandidates: KPIResult[];
}

export interface AppData {
  kpis: KPIResult[];
  supplyChain: SupplyChainResult[];
  sizeData: Record<string, SizeAllocation[]>; // styleCode -> allocations
  analysisSummary?: AnalysisSummary;
}
