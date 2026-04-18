import { STORAGE_KEY } from "@/lib/legal-analysis/constants";
import {
  createExampleAnalysis,
  createPendingExampleAnalysis,
} from "@/lib/legal-analysis/mock-data";
import type { AnalysisFormData } from "@/types/legal-analysis";

export interface AnalysisRepository {
  load(): AnalysisFormData[];
  save(records: AnalysisFormData[]): void;
}

function getSeedRecords() {
  return [createExampleAnalysis(), createPendingExampleAnalysis()];
}

export const localAnalysisRepository: AnalysisRepository = {
  load() {
    if (typeof window === "undefined") return getSeedRecords();

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeds = getSeedRecords();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }

    try {
      const parsed = JSON.parse(raw) as AnalysisFormData[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const seeds = getSeedRecords();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
        return seeds;
      }
      return parsed;
    } catch {
      const seeds = getSeedRecords();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }
  },
  save(records) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  },
};
