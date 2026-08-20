import AsyncStorage from "@react-native-async-storage/async-storage";
export async function cached<T>(key: string, loader: () => Promise<T>): Promise<{ data: T; stale: boolean }> {
  try { const data = await loader(); await AsyncStorage.setItem(`cache:${key}`, JSON.stringify(data)); return { data, stale: false }; }
  catch (error) { const value = await AsyncStorage.getItem(`cache:${key}`); if (value) return { data: JSON.parse(value) as T, stale: true }; throw error; }
}
