import { create } from "zustand";

export type ViewKey = "datasource" | "sql" | "dashboard";

interface ViewState {
  view: ViewKey;
  setView: (v: ViewKey) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  view: "datasource",
  setView: (view) => set({ view }),
}));
