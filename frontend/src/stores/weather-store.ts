import { create } from 'zustand';
import { fetchCities, type FavoriteCity } from '../lib/weather-api';

export interface CityView {
  /** 收藏城市 id（定位得到的城市无此字段） */
  cityId?: string;
  name: string;
  lon: number;
  lat: number;
}

interface WeatherState {
  cities: FavoriteCity[];
  currentCity: CityView | null;
  loadCities: () => Promise<void>;
  setCurrentCity: (city: CityView) => void;
}

export const useWeatherStore = create<WeatherState>((set, get) => ({
  cities: [],
  currentCity: null,

  loadCities: async () => {
    try {
      const cities = await fetchCities();
      const current = get().currentCity;
      if (!current && cities.length) {
        const def = cities.find((c) => c.isDefault) ?? cities[0];
        set({
          cities,
          currentCity: { cityId: def.id, name: def.name, lon: def.lng, lat: def.lat },
        });
      } else {
        set({ cities });
      }
    } catch {
      // 未登录 / 网络异常：静默（游客走定位）
    }
  },

  setCurrentCity: (city) => set({ currentCity: city }),
}));
