// src/features/auth/AuthPage.tsx
// Màn hình AUTH-01: Đăng nhập / Đăng ký tài khoản (xác thực Web Crypto FE)

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './authStore';
import { SEED_USERS, seedDatabase } from '@/db/seed';
import { db } from '@/db';
import { Button, Input, Card, Tabs } from '@/components/ui';
import { toast } from '@/components/ui/toastStore';
import { Logo } from '@/components/common/Logo';
import { ShieldCheck, LogIn, UserPlus, Sparkles, CheckCircle2 } from 'lucide-react';

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
    const email = loginEmail.trim();
    const password = loginPassword.trim();
    if (!email || !password) {
      toast.warning('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const count = await db.auth_accounts.count();
      if (count === 0) {
        await seedDatabase();
      }
      const res = await login(email, password);
      if (res.success) {
        const currentActor = useAuthStore.getState().currentActor;
        toast.success('Đăng nhập thành công!');
        if (currentActor) redirectAfterLogin(currentActor.role);
      } else {
        toast.error(res.error || 'Email hoặc mật khẩu không chính xác');
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

  const handleResetSeed = async () => {
    setLoading(true);
    try {
      await seedDatabase();
      toast.success('Đã nạp lại toàn bộ dữ liệu mẫu mặc định!');
    } catch (err) {
      toast.error('Không thể nạp dữ liệu: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (email: string) => {
    setActiveTab('login');
    setLoginEmail(email);
    setLoginPassword('password123');
    toast.info(`Đã điền tài khoản: ${email}`);
  };

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
    <div className="min-h-screen bg-gradient-to-b from-brand-50/50 via-slate-50/30 to-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center flex flex-col items-center">
        <Logo size="lg" className="mb-2" />
        <p className="text-xs text-slate-500 font-medium">
          Dịch vụ cho thuê xe máy linh hoạt & Hỗ trợ cứu hộ 24/7
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
        <Card className="p-6 sm:p-8 shadow-xl border-slate-200/80 bg-white/90 backdrop-blur-xl rounded-3xl">
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

              <Button type="submit" variant="primary" fullWidth size="lg" loading={loading} className="mt-2 shadow-md">
                Đăng nhập vào hệ thống
              </Button>
            </form>
          )}

          {/* Form Đăng ký */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="p-3 bg-brand-50 border border-brand-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-brand-900">
                <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                <span>
                  Đăng ký trực tuyến áp dụng cho tài khoản <strong>Khách hàng</strong>. Tài khoản Nhân viên và Quản trị
                  được hệ thống phân quyền nội bộ.
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
                label="Mật khẩu (tối thiểu 6 ký tự)"
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

              <Button type="submit" variant="primary" fullWidth size="lg" loading={loading} className="mt-2 shadow-md">
                Tạo tài khoản Khách hàng
              </Button>
            </form>
          )}

          {/* Bảng tài khoản mẫu phục vụ Demo */}
          <div className="mt-7 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-600" />
                Tài khoản trải nghiệm mẫu (Mật khẩu: password123)
              </h4>
              <button
                type="button"
                disabled={loading}
                onClick={handleResetSeed}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
              >
                Làm mới dữ liệu mẫu
              </button>
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
                    className="p-2.5 rounded-2xl border border-slate-200/80 hover:border-brand-500 bg-slate-50/60 hover:bg-white transition-all flex items-center justify-between gap-2 shadow-2xs hover:shadow-xs"
                  >
                    <div className="min-w-0 cursor-pointer" onClick={() => handleFillDemo(user.email)}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 truncate">{user.full_name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${roleColor}`}>
                          {roleBadge}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleFillDemo(user.email)}
                        className="px-2 py-1 text-[11px] font-medium rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95"
                      >
                        Điền
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleQuickLogin(user.email)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-all shadow-xs active:scale-95"
                      >
                        Vào ngay
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Thông báo bảo mật */}
        <div className="mt-4 px-4 text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
            Bảo mật đầu cuối với mã hóa PBKDF2 • Không lưu trữ mật khẩu thuần
          </p>
        </div>
      </div>
    </div>
  );
}
