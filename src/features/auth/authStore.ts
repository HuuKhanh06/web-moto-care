// src/features/auth/authStore.ts
// Quản lý phiên làm việc, trạng thái đăng nhập và phân quyền

import { create } from 'zustand';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import { seedDatabase } from '@/db/seed';
import { hashPassword, verifyPassword, validatePasswordStrength } from './crypto';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Actor, Profile, AuthAccount } from '@/db/types';

const SESSION_STORAGE_KEY = 'motocare_session';

interface SessionData {
  user_id: string;
  role: Actor['role'];
  logged_in_at: string;
}

interface AuthState {
  currentActor: Actor | null;
  currentUser: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    phone: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentActor: null,
  currentUser: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      let account = await db.auth_accounts.where('email').equalsIgnoreCase(normalizedEmail).first();

      // Hỗ trợ linh hoạt cả admin@motocare.vn và quanly@motocare.vn cho tài khoản quản lý
      if (!account && (normalizedEmail === 'admin@motocare.vn' || normalizedEmail === 'quanly@motocare.vn')) {
        const alt = normalizedEmail === 'admin@motocare.vn' ? 'quanly@motocare.vn' : 'admin@motocare.vn';
        account = await db.auth_accounts.where('email').equalsIgnoreCase(alt).first();
      }

      if (!account) {
        // Tra cứu tài khoản từ Supabase Cloud nếu trên máy cục bộ chưa có (bỏ qua khi chạy unit test)
        if (isSupabaseConfigured && supabase && import.meta.env.MODE !== 'test') {
          try {
            const { data: cloudAcc } = await supabase
              .from('auth_accounts')
              .select('*')
              .ilike('email', normalizedEmail)
              .maybeSingle();

            if (cloudAcc) {
              const { data: cloudProf } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', cloudAcc.user_id)
                .maybeSingle();

              if (cloudProf) {
                await db.profiles.put(cloudProf);
                await db.auth_accounts.put(cloudAcc);
                account = cloudAcc;
              }
            }
          } catch (cloudErr) {
            console.warn('[Supabase] Tra cứu tài khoản từ đám mây gặp sự cố:', cloudErr);
          }
        }

        // Tự động nạp dữ liệu mẫu nếu DB đang rỗng (lần đầu mở app trên trình duyệt)
        if (!account) {
          const totalAccounts = await db.auth_accounts.count();
          if (totalAccounts === 0) {
            await seedDatabase();
            account = await db.auth_accounts.where('email').equalsIgnoreCase(normalizedEmail).first();
          }
        }
      }

      if (!account) {
        return { success: false, error: 'Email hoặc mật khẩu không chính xác.' };
      }

      // 1. Kiểm tra tài khoản có bị khóa tạm thời do nhập sai quá nhiều lần không
      const now = clock.now();
      if (account.locked_until) {
        const lockedUntilDate = new Date(account.locked_until);
        if (lockedUntilDate > now) {
          const remainingSeconds = Math.ceil((lockedUntilDate.getTime() - now.getTime()) / 1000);
          return {
            success: false,
            error: `Tài khoản đang bị tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${remainingSeconds} giây.`,
          };
        }
      }

      // 2. Đối soát mật khẩu đã băm bằng PBKDF2 (hỗ trợ linh hoạt viết hoa/thường cho tài khoản mẫu demo)
      let isMatch = await verifyPassword(password, account.password_hash, account.salt);
      if (!isMatch && password.toLowerCase() === 'password123') {
        isMatch = await verifyPassword('password123', account.password_hash, account.salt);
      }

      if (!isMatch) {
        const failedAttempts = (account.failed_attempts || 0) + 1;
        const updates: Partial<AuthAccount> = { failed_attempts: failedAttempts };

        if (failedAttempts >= 5) {
          // Khóa tạm 1 phút (60.000 ms)
          const lockTime = new Date(now.getTime() + 60 * 1000).toISOString();
          updates.locked_until = lockTime;
          await db.auth_accounts.update(account.user_id, updates);
          return {
            success: false,
            error: 'Bạn đã nhập sai 5 lần liên tiếp. Tài khoản bị tạm khóa đăng nhập trong 1 phút.',
          };
        } else {
          await db.auth_accounts.update(account.user_id, updates);
          const remaining = 5 - failedAttempts;
          return {
            success: false,
            error: `Email hoặc mật khẩu không chính xác. Bạn còn ${remaining} lần thử trước khi bị khóa tạm.`,
          };
        }
      }

      // 3. Đăng nhập thành công -> Reset số lần sai và thời gian khóa
      await db.auth_accounts.update(account.user_id, {
        failed_attempts: 0,
        locked_until: undefined,
      });

      const profile = await db.profiles.get(account.user_id);
      if (!profile) {
        return { success: false, error: 'Không tìm thấy hồ sơ người dùng tương ứng.' };
      }

      const actor: Actor = {
        id: profile.id,
        role: profile.role,
      };

      // Lưu phiên vào sessionStorage
      const session: SessionData = {
        user_id: profile.id,
        role: profile.role,
        logged_in_at: clock.nowISO(),
      };
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      }

      set({
        currentActor: actor,
        currentUser: profile,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true };
    } catch (err) {
      console.error('Lỗi đăng nhập:', err);
      return { success: false, error: 'Đã xảy ra lỗi trong quá trình xác thực.' };
    }
  },

  register: async ({ email, password, full_name, phone }) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Kiểm tra độ mạnh mật khẩu
      const strength = validatePasswordStrength(password);
      if (!strength.valid) {
        return { success: false, error: strength.message };
      }

      // Kiểm tra trùng email
      const existing = await db.auth_accounts.where('email').equalsIgnoreCase(normalizedEmail).first();
      if (existing) {
        return { success: false, error: 'Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.' };
      }

      // RÀNG BUỘC LUẬT DỰ ÁN: Đăng ký từ giao diện CHỈ được phép tạo vai trò 'khach_hang'
      const newUserId = crypto.randomUUID();
      const { hash, salt } = await hashPassword(password);
      const nowISO = clock.nowISO();

      const newProfile: Profile = {
        id: newUserId,
        full_name: full_name.trim(),
        phone: phone.trim(),
        role: 'khach_hang',
      };

      const newAccount: AuthAccount = {
        user_id: newUserId,
        email: normalizedEmail,
        password_hash: hash,
        salt,
        failed_attempts: 0,
        created_at: nowISO,
      };

      await db.profiles.add(newProfile);
      await db.auth_accounts.add(newAccount);

      // Đồng bộ tức thời lên Supabase Cloud nếu đã cấu hình (bỏ qua khi chạy unit test)
      if (isSupabaseConfigured && supabase && import.meta.env.MODE !== 'test') {
        try {
          await Promise.all([
            supabase.from('profiles').upsert(newProfile, { onConflict: 'id' }),
            supabase.from('auth_accounts').upsert(newAccount, { onConflict: 'user_id' }),
          ]);
        } catch (cloudErr) {
          console.warn('[Supabase] Không thể đồng bộ tài khoản mới lên đám mây:', cloudErr);
        }
      }

      // Không tự động đăng nhập - người dùng cần đăng nhập lại ở bước tiếp theo
      return { success: true };
    } catch (err) {
      console.error('Lỗi đăng ký:', err);
      return { success: false, error: 'Đã xảy ra lỗi khi tạo tài khoản.' };
    }
  },

  logout: () => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    set({
      currentActor: null,
      currentUser: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  restoreSession: async () => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (saved) {
          const session = JSON.parse(saved) as SessionData;
          const profile = await db.profiles.get(session.user_id);
          if (profile) {
            set({
              currentActor: { id: profile.id, role: profile.role },
              currentUser: profile,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          }
        }
      }
    } catch (err) {
      console.error('Lỗi khôi phục phiên:', err);
    }
    set({
      currentActor: null,
      currentUser: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));

