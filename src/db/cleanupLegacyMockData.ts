// src/db/cleanupLegacyMockData.ts
// Bước dọn dẹp một lần dữ liệu giả mạo do các phiên bản mock cũ lưu vào IndexedDB
// Xóa sạch 'NGUYEN VAN A', '079201008888', '1995-05-12' trong process_state và profiles

import { db } from '@/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/authStore';
import { SEED_USERS } from '@/db/seed';

export interface CleanupReport {
  cleaned: boolean;
  affectedProcessStates: string[];
  affectedProfiles: Array<{ id: string; email?: string; oldName: string; newName: string }>;
}

export async function cleanupLegacyMockData(force = false): Promise<CleanupReport> {
  const CLEANUP_KEY = 'motocare_legacy_mock_cleaned_v3';
  const affectedProcessStates: string[] = [];
  const affectedProfiles: Array<{ id: string; email?: string; oldName: string; newName: string }> = [];

  try {
    // 1. Quét và dọn sạch các biến trích xuất giả trong db.process_state
    const allStates = await db.process_state.toArray();
    for (const state of allStates) {
      const vars = state.variables || {};
      const isMockName = vars.customer_full_name === 'NGUYEN VAN A' || vars.customer_full_name === 'NGUYỄN VĂN A';
      const isMockId = vars.customer_id_number === '079201008888';
      const isMockDob = vars.customer_dob === '1995-05-12' || vars.customer_dob === '2001-10-10';

      if (isMockName || isMockId || isMockDob || force) {
        // Xóa sạch các trường giả định
        const cleanedVars = { ...vars };
        delete cleanedVars.customer_full_name;
        delete cleanedVars.customer_id_number;
        delete cleanedVars.customer_dob;
        delete cleanedVars.customer_license_class;
        delete cleanedVars.customer_address;
        delete cleanedVars.extracted_cccd;
        delete cleanedVars.extracted_gplx;

        await db.process_state.update(state.request_id, {
          variables: cleanedVars,
        });
        affectedProcessStates.push(state.request_id);
      }
    }

    // 2. Khôi phục hồ sơ nếu trước đó bị mock đè thành 'NGUYEN VAN A'
    // TUYỆT ĐỐI KHÔNG đoán tên khách hàng từ email hay bất kỳ chuỗi nào.
    // Tên khách hàng lấy chính xác từ trường 'Họ và tên' khi người dùng đăng ký tài khoản.
    const allProfiles = await db.profiles.toArray();
    for (const prof of allProfiles) {
      if (prof.full_name === 'NGUYEN VAN A' || prof.full_name === 'NGUYỄN VĂN A') {
        const account = await db.auth_accounts.where('user_id').equals(prof.id).first();
        const seedMatch = SEED_USERS.find(
          (u) => u.id === prof.id || (account && u.email.toLowerCase() === account.email.toLowerCase())
        );
        // Nếu là tài khoản seed thì trả về đúng tên seed đã định nghĩa; nếu là tài khoản người dùng thì đặt 'Khách hàng' để họ tự đổi tên
        const fallbackName = seedMatch ? seedMatch.full_name : 'Khách hàng';

        await db.profiles.update(prof.id, {
          full_name: fallbackName,
        });

        // Đồng bộ lên Supabase Cloud nếu có kết nối
        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.from('profiles').update({ full_name: fallbackName }).eq('id', prof.id);
          } catch {
            // Không ngắt luồng nếu offline
          }
        }

        // Cập nhật ngay lập tức currentUser trong authStore nếu đang đăng nhập
        const currentAuthUser = useAuthStore.getState().currentUser;
        if (currentAuthUser && currentAuthUser.id === prof.id) {
          useAuthStore.setState({
            currentUser: { ...currentAuthUser, full_name: fallbackName },
          });
        }

        affectedProfiles.push({
          id: prof.id,
          email: account?.email,
          oldName: prof.full_name,
          newName: fallbackName,
        });
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CLEANUP_KEY, 'true');
    }

    console.info('[cleanupLegacyMockData] Đã dọn dẹp dữ liệu giả:', {
      processStatesCleaned: affectedProcessStates.length,
      profilesCleaned: affectedProfiles.length,
    });

    return {
      cleaned: true,
      affectedProcessStates,
      affectedProfiles,
    };
  } catch (err) {
    console.error('[cleanupLegacyMockData] Lỗi trong quá trình dọn dẹp:', err);
    return {
      cleaned: false,
      affectedProcessStates,
      affectedProfiles,
    };
  }
}
