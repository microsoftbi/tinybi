import { create } from "zustand";
import type { SavedConnection, SqlServerConfig } from "@/types";

export const DEFAULT_FORM: SqlServerConfig = {
  host: "",
  port: 1433,
  username: "",
  password: "",
  database: "",
  encrypt: false,
};

interface ConnectionState {
  form: SqlServerConfig;
  connections: SavedConnection[];
  setForm: (patch: Partial<SqlServerConfig>) => void;
  loadForm: (cfg: Partial<SqlServerConfig>) => void;
  resetForm: () => void;
  addConnection: (c: SavedConnection) => void;
  removeConnection: (id: string) => void;
  setConnections: (c: SavedConnection[]) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  form: { ...DEFAULT_FORM },
  connections: [],
  setForm: (patch) => set((s) => ({ form: { ...s.form, ...patch } })),
  loadForm: (cfg) => set((s) => ({ form: { ...s.form, ...cfg } })),
  resetForm: () => set({ form: { ...DEFAULT_FORM } }),
  addConnection: (c) => set((s) => ({ connections: [...s.connections, c] })),
  removeConnection: (id) =>
    set((s) => ({ connections: s.connections.filter((x) => x.id !== id) })),
  setConnections: (connections) => set({ connections }),
}));
