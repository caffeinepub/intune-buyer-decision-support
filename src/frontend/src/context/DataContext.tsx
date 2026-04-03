import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { initialData } from "../data/sampleData";
import type {
  AnalysisSummary,
  AppData,
  KPIResult,
  SupplyChainResult,
  VMDeckEntry,
} from "../types";

const VM_DECK_STORAGE_KEY = "intune_vm_deck_data";

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
  vmDeckData: Record<string, VMDeckEntry>;
  setVMDeckData: (data: Record<string, VMDeckEntry>) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

/** Load vmDeckData from localStorage if available */
function loadVMDeckFromStorage(): Record<string, VMDeckEntry> {
  try {
    const raw = localStorage.getItem(VM_DECK_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, VMDeckEntry>;
  } catch {
    // ignore
  }
  return {};
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(initialData);
  const [filters, setFilters] = useState<Filters>({
    season: "all",
    category: "all",
  });

  // Initialize vmDeckData from localStorage so it persists across sessions
  const [vmDeckData, setVMDeckDataState] = useState<
    Record<string, VMDeckEntry>
  >(() => {
    const fromStorage = loadVMDeckFromStorage();
    if (Object.keys(fromStorage).length > 0) return fromStorage;
    return initialData.vmDeckData || {};
  });

  // Persist vmDeckData to localStorage whenever it changes
  useEffect(() => {
    try {
      if (Object.keys(vmDeckData).length > 0) {
        localStorage.setItem(VM_DECK_STORAGE_KEY, JSON.stringify(vmDeckData));
      }
    } catch {
      // localStorage quota exceeded — silently ignore
    }
  }, [vmDeckData]);

  function setVMDeckData(newData: Record<string, VMDeckEntry>) {
    setVMDeckDataState(newData);
  }

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
    // Merge VM deck data from new file if provided, but keep existing if not
    if (newData.vmDeckData && Object.keys(newData.vmDeckData).length > 0) {
      setVMDeckData({ ...vmDeckData, ...newData.vmDeckData });
    }
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
        vmDeckData,
        setVMDeckData,
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
