import * as Location from 'expo-location';

export interface LocatedCity {
  name: string;
  lon: number;
  lat: number;
}

/**
 * 获取当前位置（最小必要：仅用于默认城市定位，可拒绝后手动选城市）。
 * expo-location 为 M2 新增依赖（`npx expo install expo-location`）。
 */
export async function getLocatedCity(): Promise<LocatedCity | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = pos.coords;

    let name = '当前位置';
    try {
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      const first = geocode[0];
      if (first) {
        name = first.city ?? first.district ?? first.region ?? '当前位置';
      }
    } catch {
      // 反地理编码失败不阻断：以坐标展示
    }
    return { name, lon: longitude, lat: latitude };
  } catch {
    return null;
  }
}
