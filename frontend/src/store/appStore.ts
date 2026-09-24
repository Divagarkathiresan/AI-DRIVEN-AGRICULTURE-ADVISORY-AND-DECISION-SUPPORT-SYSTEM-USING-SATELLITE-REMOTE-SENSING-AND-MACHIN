import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { clearAuthSession, getAuthSession, saveAuthSession } from "@/services/authStorage";
import type { AppNotification, AuthSession, CropPredictionResult, Farm, FarmFormValues } from "@/types/domain";

const initialDraft: FarmFormValues = {
  user_id: "",
  farm_name: "",
  crop_name: "",
  area: {
    value: 0,
    unit: "acre",
  },
  location: {
    latitude: 0,
    longitude: 0,
  },
  soil_type: "",
  irrigation_type: "",
  planting_date: "",
  description: "",
};

type AppState = {
  auth: AuthSession;
  addFarmDraft: FarmFormValues;
  predictionResult: CropPredictionResult | null;
  farms: Farm[];
  selectedFarm: Farm | null;
  notifications: AppNotification[];
  initializeAuth: () => Promise<void>;
  setAuthenticated: (session: Omit<AuthSession, "isAuthenticated">) => Promise<void>;
  logout: () => Promise<void>;
  updateFarmDraft: (values: Partial<FarmFormValues>) => void;
  resetFarmDraft: (userId?: string) => void;
  setPredictionResult: (result: CropPredictionResult | null) => void;
  addFarm: (farm: Farm) => void;
  setFarms: (farms: Farm[]) => void;
  setSelectedFarm: (farm: Farm | null) => void;
  addHarvestNotification: (notification: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markNotificationsRead: () => void;
};

const defaultAuth: AuthSession = {
  isAuthenticated: false,
  phone: "",
  userId: "",
  accessToken: "",
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      auth: defaultAuth,
      addFarmDraft: initialDraft,
      predictionResult: null,
      farms: [],
      selectedFarm: null,
      notifications: [],
      initializeAuth: async () => {
        const saved = await getAuthSession();
        if (!saved) return;
        set({ auth: saved });
      },
      setAuthenticated: async (session) => {
        const auth = { ...session, isAuthenticated: true };
        await saveAuthSession(auth);
        set((state) => ({
          auth,
          addFarmDraft: {
            ...state.addFarmDraft,
            user_id: session.userId,
          },
        }));
      },
      logout: async () => {
        await clearAuthSession();
        set({ auth: defaultAuth, predictionResult: null, farms: [], selectedFarm: null });
      },
      updateFarmDraft: (values) =>
        set((state) => ({
          addFarmDraft: {
            ...state.addFarmDraft,
            ...values,
            area: values.area
              ? { ...state.addFarmDraft.area, ...values.area }
              : state.addFarmDraft.area,
            location: values.location
              ? { ...state.addFarmDraft.location, ...values.location }
              : state.addFarmDraft.location,
          },
        })),
      resetFarmDraft: (userId) =>
        set({
          addFarmDraft: {
            ...initialDraft,
            user_id: userId ?? get().auth.userId,
          },
        }),
      setPredictionResult: (result) => set({ predictionResult: result }),
      addFarm: (farm) =>
        set((state) => ({
          farms: [farm, ...state.farms],
        })),
      setFarms: (farms) => set({ farms }),
      setSelectedFarm: (farm) => set({ selectedFarm: farm }),
      addHarvestNotification: (notification) =>
        set((state) => {
          const id = `harvest-${notification.farmId}`;
          if (state.notifications.some((item) => item.id === id)) return state;
          return {
            notifications: [{ ...notification, id, createdAt: new Date().toISOString(), read: false }, ...state.notifications],
          };
        }),
      markNotificationsRead: () => set((state) => ({
        notifications: state.notifications.map((notification) => ({ ...notification, read: true })),
      })),
    }),
    {
      name: "smart-agriculture-state",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        addFarmDraft: state.addFarmDraft,
        predictionResult: state.predictionResult,
        farms: state.farms,
        selectedFarm: state.selectedFarm,
        notifications: state.notifications,
      }),
    },
  ),
);
