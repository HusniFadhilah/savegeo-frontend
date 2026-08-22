import { create } from "zustand";
import { createField, getField, listFields } from "@/features/crop-monitoring/api";
import type { CreateFieldPayload, Field } from "@/features/crop-monitoring/types";
import { useAoiStore } from "@/hooks/useAoiStore";

interface FieldStore {
  fields: Field[];
  selectedField: Field | null;
  loading: boolean;
  loadFields: () => Promise<void>;
  selectField: (id: number) => Promise<void>;
  saveField: (payload: CreateFieldPayload) => Promise<Field>;
  clearSelection: () => void;
}

/**
 * Crop Monitoring's Field registry - a saved AOI + commodity metadata,
 * distinct from the ephemeral `useAoiStore` draw state. Selecting a field
 * pushes its geometry into `useAoiStore` (source: "drawn") so the shared
 * map/draw tools reflect it, matching how every other module reads the AOI.
 */
export const useFieldStore = create<FieldStore>((set, get) => ({
  fields: [],
  selectedField: null,
  loading: false,

  loadFields: async () => {
    set({ loading: true });
    try {
      const res = await listFields();
      set({ fields: res.fields });
    } finally {
      set({ loading: false });
    }
  },

  selectField: async (id) => {
    set({ loading: true });
    try {
      const field = await getField(id);
      set({ selectedField: field });
      if (field.geojson) {
        useAoiStore.getState().setAoi({
          source: "drawn",
          name: field.name,
          areaKm2: field.area_ha / 100,
          feature: { type: "Feature", properties: {}, geometry: field.geojson },
          bounds: null,
        });
      }
    } finally {
      set({ loading: false });
    }
  },

  saveField: async (payload) => {
    const field = await createField(payload);
    set({ selectedField: field });
    await get().loadFields();
    return field;
  },

  clearSelection: () => set({ selectedField: null }),
}));
