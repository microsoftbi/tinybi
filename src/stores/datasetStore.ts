import { create } from "zustand";
import type { Dataset } from "@/types";

interface DatasetState {
  datasets: Dataset[];
  addDataset: (d: Dataset) => void;
  removeDataset: (id: string) => void;
  setDatasets: (d: Dataset[]) => void;
}

export const useDatasetStore = create<DatasetState>((set) => ({
  datasets: [],
  addDataset: (d) => set((s) => ({ datasets: [...s.datasets, d] })),
  removeDataset: (id) =>
    set((s) => ({ datasets: s.datasets.filter((x) => x.id !== id) })),
  setDatasets: (datasets) => set({ datasets }),
}));
