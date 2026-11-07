// src/features/auth/AuthPage.tsx
// Màn hình Đăng nhập & Tạo tài khoản

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './authStore';
import { seedDatabase } from '@/db/seed';
import { db } from '@/db';
import { Button, Input, Card } from '@/components/ui';
import { toast } from '@/components/ui/toastStore';
import { Logo } from '@/components/common/Logo';
import { ShieldCheck } from 'lucide-react';

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
    } else if (role === 'quan_ly') {
      navigate('/ql/dashboard', { replace: true });
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
        console.error('Lỗi kiểm tra tài khoản khởi tạo:', err);
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
      toast.warning('Vui lòng điền đầy đủ thông tin');
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
      toast.success('Tạo tài khoản thành công! Bạn có thể đăng nhập ngay.');
      setActiveTab('login');
      setLoginEmail(regEmail);
      setLoginPassword('');
      setRegFullName('');
      setRegPhone('');
      setRegEmail('');
      setRegPassword('');
      setRegConfirmPassword('');
    } else {
      toast.error(res.error || 'Đăng ký tài khoản chưa thành công');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Logo & Tiêu đề */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center flex flex-col items-center">
        <Logo size="lg" className="mb-3" />
        <p className="text-sm text-slate-500 font-normal">
          Thuê xe máy tự lái tại Đà Nẵng · Nhận xe nhanh chóng
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <Card className="p-6 md:p-8 border border-slate-200 bg-white rounded-xl space-y-6">
          {/* Tabs Đăng nhập / Đăng ký */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tạo tài khoản
            </button>
          </div>

          {/* Form Đăng nhập */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Địa chỉ email"
                type="email"
                placeholder="vd: khachhang@gmail.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />

              <Input
                label="Mật khẩu"
                type="password"
                placeholder="Nhập mật khẩu"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={loading}
              >
                Đăng nhập
              </Button>
            </form>
          )}

          {/* Form Đăng ký */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
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
                placeholder="vd: 0901 234 567"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                required
              />

              <Input
                label="Địa chỉ email"
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

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={loading}
              >
                Tạo tài khoản
              </Button>
            </form>
          )}
        </Card>

        {/* Thông tin bảo mật */}
        <p className="mt-4 text-[13px] text-slate-400 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Bảo mật thông tin tài khoản đạt tiêu chuẩn</span>
        </p>
      </div>
    </div>
  );
}

export default AuthPage;
