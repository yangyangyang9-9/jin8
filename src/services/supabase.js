import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = 'https://yogdjoisougtrgsuonbq.supabase.co';
// 使用 Publishable key
const supabaseKey = 'sb_publishable_thpUriXC_fUAmlwicqRREw_JsUBoyxV';

// 创建 Supabase 客户端
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    storage: {
      getItem: async (key) => {
        try {
          return await SecureStore.getItemAsync(key);
        } catch (error) {
          console.error('Error getting item from SecureStore:', error);
          return null;
        }
      },
      setItem: async (key, value) => {
        try {
          await SecureStore.setItemAsync(key, value);
        } catch (error) {
          console.error('Error setting item in SecureStore:', error);
        }
      },
      removeItem: async (key) => {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (error) {
          console.error('Error removing item from SecureStore:', error);
        }
      },
    },
  }
});

// 检查是否有有效的会话
export const hasValidSession = async () => {
  try {
    const session = await SecureStore.getItemAsync('session');
    return !!session;
  } catch (error) {
    console.error('Error checking session:', error);
    return false;
  }
};

// 获取存储的会话
export const getStoredSession = async () => {
  try {
    const session = await SecureStore.getItemAsync('session');
    return session ? JSON.parse(session) : null;
  } catch (error) {
    console.error('Error getting stored session:', error);
    return null;
  }
};
