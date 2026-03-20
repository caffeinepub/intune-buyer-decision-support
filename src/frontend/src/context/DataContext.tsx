import { type ReactNode, createContext, useContext, useState } from "react";
import { initialData } from "../data/sampleData";
import type {
  AnalysisSummary,
  AppData,
  KPIResult,
  SupplyChainResult,
} from "../types";

interface Filters {
  season: string;
  category: string;
}

interface DataContextValue {
  data: AppData;
  setData: (data: AppData) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  filteredKPIs: KPIResult[];
  filteredSupplyChain: SupplyChainResult[];
  seasons: string[];
  categories: string[];
  analysisSummary: AnalysisSummary | undefined;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(initialData);
  const [filters, setFilters] = useState<Filters>({
    season: "all",
    category: "all",
  });

  const filteredKPIs = data.kpis.filter((k) => {
    if (filters.season !== "all" && k.season !== filters.season) return false;
    if (filters.category !== "all" && k.category !== filters.category)
      return false;
    return true;
  });

  const filteredSupplyChain = data.supplyChain.filter((s) => {
    if (filters.season !== "all" && s.season !== filters.season) return false;
    return true;
  });

  const seasons = Array.from(new Set(data.kpis.map((k) => k.season)));
  const categories = Array.from(new Set(data.kpis.map((k) => k.category)));

  // Reset filters when new data is loaded to avoid stale filter values
  function handleSetData(newData: AppData) {
    setData(newData);
    setFilters({ season: "all", category: "all" });
  }

  return (
    <DataContext.Provider
      value={{
        data,
        setData: handleSetData,
        filters,
        setFilters,
        filteredKPIs,
        filteredSupplyChain,
        seasons,
        categories,
        analysisSummary: data.analysisSummary,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
