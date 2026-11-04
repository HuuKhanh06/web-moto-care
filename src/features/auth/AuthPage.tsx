// src/features/auth/AuthPage.tsx
// Màn hình AUTH-01: Đăng nhập / Đăng ký tài khoản (xác thực Web Crypto FE)

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './authStore';
import { SEED_USERS, seedDatabase } from '@/db/seed';
import { db } from '@/db';
import { Button, Input, Card, Tabs } from '@/components/ui';
import { toast } from '@/components/ui/toastStore';
import { ShieldCheck, LogIn, UserPlus, Info, CheckCircle2 } from 'lucide-react';

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  // Form đăng nhập
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Form đăng ký
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const redirectAfterLogin = (role: string) => {
    // Nếu có location state hướng tới trang trước đó thì chuyển về đó
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
    if (from && from !== '/login') {
      navigate(from, { replace: true });
      return;
    }

    if (role === 'khach_hang') {
      navigate('/kh/06', { replace: true });
    } else {
      navigate('/nv/01', { replace: true });
    }
  };

  // Tự động kiểm tra và nạp dữ liệu mẫu nếu IndexedDB đang trống
  useEffect(() => {
    async function ensureSeed() {
      try {
        const count = await db.auth_accounts.count();
        if (count === 0) {
          await seedDatabase();
        }
      } catch (err) {
        console.error('Seed check error:', err);
      }
    }
    ensureSeed();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.warning('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const count = await db.auth_accounts.count();
      if (count === 0) {
        await seedDatabase();
      }
      const res = await login(loginEmail, loginPassword);
      if (res.success) {
        const currentActor = useAuthStore.getState().currentActor;
        toast.success('Đăng nhập thành công!');
        if (currentActor) redirectAfterLogin(currentActor.role);
      } else {
        toast.error(res.error || 'Đăng nhập thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName || !regPhone || !regEmail || !regPassword) {
      toast.warning('Vui lòng điền đầy đủ tất cả các trường');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    const res = await register({
      email: regEmail,
      password: regPassword,
      full_name: regFullName,
      phone: regPhone,
    });
    setLoading(false);

    if (res.success) {
      toast.success('Đăng ký tài khoản khách hàng thành công!');
      redirectAfterLogin('khach_hang');
    } else {
      toast.error(res.error || 'Đăng ký thất bại');
    }
  };

  // Nút đăng nhập nhanh cho các tài khoản mẫu
  const handleQuickLogin = async (email: string) => {
    setLoading(true);
    try {
      const count = await db.auth_accounts.count();
      if (count === 0) {
        await seedDatabase();
      }
      const res = await login(email, 'password123');
      if (res.success) {
        const currentActor = useAuthStore.getState().currentActor;
        toast.success(`Đăng nhập thành công với vai trò ${currentActor?.role}`);
        if (currentActor) redirectAfterLogin(currentActor.role);
      } else {
        toast.error(res.error || 'Đăng nhập mẫu thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/60 to-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/30 mb-3">
          <span className="text-2xl font-black tracking-wider">MC</span>
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">MOTO CARE</h2>
        <p className="mt-1 text-sm text-slate-500 font-medium">
          Hệ thống Quản lý & Thuê xe máy thông minh (BPMN To-Be)
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
        <Card className="p-6 sm:p-8 shadow-md border-slate-200">
          {/* Tabs chuyển đổi Đăng nhập / Đăng ký */}
          <Tabs
            tabs={[
              { id: 'login', label: 'Đăng nhập', icon: LogIn },
              { id: 'register', label: 'Đăng ký tài khoản mới', icon: UserPlus },
            ]}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as 'login' | 'register')}
            className="mb-6"
          />

          {/* Form Đăng nhập */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Địa chỉ Email"
                type="email"
                placeholder="vd: khachhang1@gmail.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />

              <Input
                label="Mật khẩu"
                type="password"
                placeholder="Nhập mật khẩu của bạn"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />

              <Button type="submit" variant="primary" fullWidth size="lg" loading={loading} className="mt-2">
                Đăng nhập hệ thống
              </Button>
            </form>
          )}

          {/* Form Đăng ký */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl flex items-start gap-2.5 text-xs text-brand-900">
                <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                <span>
                  Đăng ký trực tuyến áp dụng cho vai trò <strong>Khách hàng</strong>. Tài khoản Nhân viên và Quản lý
                  được quản trị viên cấp phát.
                </span>
              </div>

              <Input
                label="Họ và tên"
                placeholder="vd: Nguyễn Văn An"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                required
              />

              <Input
                label="Số điện thoại"
                type="tel"
                placeholder="vd: 0901234567"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                required
              />

              <Input
                label="Email đăng nhập"
                type="email"
                placeholder="vd: an.nguyen@gmail.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />

              <Input
                label="Mật khẩu (tối thiểu 6 ký tự, gồm cả chữ và số)"
                type="password"
                placeholder="Nhập mật khẩu"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
              />

              <Input
                label="Xác nhận mật khẩu"
                type="password"
                placeholder="Nhập lại mật khẩu"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                required
              />

              <Button type="submit" variant="primary" fullWidth size="lg" loading={loading} className="mt-2">
                Tạo tài khoản Khách hàng
              </Button>
            </form>
          )}

          {/* Bảng tài khoản mẫu phục vụ Demo */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-brand-600" />
                Tài khoản mẫu để Demo (Mật khẩu: password123)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {SEED_USERS.map((user) => {
                const roleBadge =
                  user.role === 'quan_ly'
                    ? 'Quản lý'
                    : user.role === 'nhan_vien'
                    ? 'Nhân viên'
                    : 'Khách hàng';

                const roleColor =
                  user.role === 'quan_ly'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : user.role === 'nhan_vien'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-brand-50 text-brand-700 border-brand-200';

                return (
                  <div
                    key={user.id}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-brand-400 bg-slate-50/50 hover:bg-white transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 truncate">{user.full_name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${roleColor}`}>
                          {roleBadge}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                    </div>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleQuickLogin(user.email)}
                      className="px-2 py-1 text-[11px] font-medium rounded-lg bg-white border border-slate-300 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-400 text-slate-700 transition-colors shadow-sm flex-shrink-0"
                    >
                      Chọn
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Thông báo pháp lý & Đồ án */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-600 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Lưu ý bảo vệ đồ án môn học:</strong> Toàn bộ cơ chế xác thực, băm mật khẩu PBKDF2 (100.000 vòng lặp)
            và quản lý phiên đều chạy 100% phía Frontend (Trình duyệt) qua Web Crypto API và IndexedDB, không dùng server ngoài.
          </p>
        </div>
      </div>
    </div>
  );
}
