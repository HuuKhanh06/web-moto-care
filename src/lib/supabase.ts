// src/lib/supabase.ts
// Khởi tạo Supabase Client với cơ chế an toàn & kiểm tra tính khả dụng

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DATA_EPOCH, clearPreviousBrowserSession } from '@/config/dataEpoch';

const DEFAULT_SUPABASE_URL = 'https://cvgbgwuzhkuinwzlyijt.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_-posW-CjJBUJIBFjEDTaUQ_xK8qEcgD';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

if (import.meta.env.MODE !== 'test' && typeof window !== 'undefined') {
  clearPreviousBrowserSession(localStorage, sessionStorage, new URL(supabaseUrl).hostname.split('.')[0]);
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        if (url.pathname.startsWith('/rest/v1/')) headers.set('x-motocare-data-epoch', DATA_EPOCH);
        return fetch(input, { ...init, headers });
      } },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;
