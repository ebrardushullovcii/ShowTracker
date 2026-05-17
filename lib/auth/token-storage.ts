import type { TokenStorage } from "@convex-dev/auth/react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

function getWebStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch (error) {
    console.error("localStorage is unavailable", error);
    return null;
  }
}

const inMemoryWebStorage = new Map<string, string>();
const inMemoryNativeStorage = new Map<string, string>();

export const tokenStorage: TokenStorage = {
  async getItem(key) {
    if (Platform.OS === "web") {
      try {
        const storage = getWebStorage();
        const value = storage?.getItem(key) ?? inMemoryWebStorage.get(key) ?? null;
        if (value !== null) {
          inMemoryWebStorage.set(key, value);
        }
        return value;
      } catch (error) {
        console.error("Web storage getItem failed", error);
        return inMemoryWebStorage.get(key) ?? null;
      }
    }
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null) {
        inMemoryNativeStorage.set(key, value);
        return value;
      }
      return inMemoryNativeStorage.get(key) ?? null;
    } catch (error) {
      console.error("SecureStore getItem failed", error);
      return inMemoryNativeStorage.get(key) ?? null;
    }
  },
  async setItem(key, value) {
    if (Platform.OS === "web") {
      try {
        getWebStorage()?.setItem(key, value);
      } catch (error) {
        console.error("Web storage setItem failed", error);
      } finally {
        inMemoryWebStorage.set(key, value);
      }
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("SecureStore setItem failed", error);
    } finally {
      inMemoryNativeStorage.set(key, value);
    }
  },
  async removeItem(key) {
    if (Platform.OS === "web") {
      try {
        getWebStorage()?.removeItem(key);
      } catch (error) {
        console.error("Web storage removeItem failed", error);
      } finally {
        inMemoryWebStorage.delete(key);
      }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error("SecureStore removeItem failed", error);
    } finally {
      inMemoryNativeStorage.delete(key);
    }
  },
};
