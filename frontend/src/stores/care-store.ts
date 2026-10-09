import { create } from 'zustand';
import {
  acceptInvite as apiAcceptInvite,
  createInvite as apiCreateInvite,
  listElders as apiListElders,
  listRelationships as apiListRelationships,
  removeRelationship as apiRemoveRelationship,
  type CareInvite,
  type CareRelationship,
  type ElderSummary,
} from '../lib/care-api';

interface CareState {
  relationships: CareRelationship[];
  elders: ElderSummary[];
  loading: boolean;
  error: string | null;

  loadRelationships: () => Promise<void>;
  loadElders: () => Promise<void>;
  createInvite: () => Promise<CareInvite>;
  acceptInvite: (code: string) => Promise<CareRelationship>;
  removeRelationship: (id: string) => Promise<void>;
}

export const useCareStore = create<CareState>((set, get) => ({
  relationships: [],
  elders: [],
  loading: false,
  error: null,

  loadRelationships: async () => {
    set({ loading: true, error: null });
    try {
      set({ relationships: await apiListRelationships() });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载失败' });
    } finally {
      set({ loading: false });
    }
  },

  loadElders: async () => {
    set({ loading: true, error: null });
    try {
      set({ elders: await apiListElders() });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载失败' });
    } finally {
      set({ loading: false });
    }
  },

  createInvite: () => apiCreateInvite(),

  acceptInvite: async (code: string) => {
    const rel = await apiAcceptInvite(code);
    await get().loadRelationships();
    return rel;
  },

  removeRelationship: async (id: string) => {
    await apiRemoveRelationship(id);
    await Promise.all([get().loadRelationships(), get().loadElders()]);
  },
}));
