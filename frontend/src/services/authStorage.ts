import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SELLER_SESSION_KEY = 'thegem_seller_session_v1';
const DEVICE_FP_KEY = 'thegem_device_fp_v1';

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const clerkTokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await getItem(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await setItem(key, value);
    } catch {
      // ignore storage errors
    }
  },
};

export interface SellerSessionTokens {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  deviceFingerprint: string;
}

export const sellerTokenStorage = {
  async get(): Promise<SellerSessionTokens | null> {
    const raw = await getItem(SELLER_SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SellerSessionTokens;
    } catch {
      return null;
    }
  },
  async set(tokens: SellerSessionTokens): Promise<void> {
    await setItem(SELLER_SESSION_KEY, JSON.stringify(tokens));
  },
  async clear(): Promise<void> {
    await deleteItem(SELLER_SESSION_KEY);
  },
};

export async function getOrCreateDeviceFingerprint(): Promise<string> {
  const existing = await getItem(DEVICE_FP_KEY);
  if (existing) return existing;
  const generated = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await setItem(DEVICE_FP_KEY, generated);
  return generated;
}
