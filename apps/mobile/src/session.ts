import * as SecureStore from "expo-secure-store";
const KEY = "wariatkowo.session.v1";
export const sessionStore = { get: () => SecureStore.getItemAsync(KEY), set: (token: string) => SecureStore.setItemAsync(KEY, token), clear: () => SecureStore.deleteItemAsync(KEY) };
