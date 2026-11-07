// src/features/auth/AuthPage.tsx
// Màn hình Đăng nhập & Tạo tài khoản chuẩn thương mại MotoCare Đà Nẵng (Split Layout 2 cột)

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from './authStore';
import { seedDatabase } from '@/db/seed';
import { db } from '@/db';
import { Button, Input } from '@/components/ui';
import { toast } from '@/components/ui/toastStore';
import { getAssetUrl } from '@/lib/vehicleImages';
import { cn } from '@/lib/utils';
import {
  Bike,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowLeft,
  Globe,
  CheckCircle2,
  Sparkles,
  PhoneCall,
} from 'lucide-react';

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  // Form đăng nhập
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Form đăng ký
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-3 sm:p-6 lg:p-10">
      {/* Khung chứa chia 2 cột chuẩn thiết kế hiện đại */}
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[660px]">
        {/* ============================================================== */}
        {/* CỘT TRÁI: KHU VỰC THƯƠNG HIỆU & HÌNH ẢNH MINH HỌA             */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          {/* Họa tiết phát sáng nền */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Phần đầu: Logo thương hiệu */}
          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform">
                <Bike className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-white block">
                  MOTO CARE<span className="text-teal-400">.</span>
                </span>
                <span className="text-[11px] text-teal-300/80 font-semibold tracking-wider uppercase block">
                  Đà Nẵng Rental
                </span>
              </div>
            </Link>
          </div>

          {/* Phần giữa: Tiêu đề & Card hình ảnh xe */}
          <div className="relative z-10 my-8 space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-400/30 text-teal-300 text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Nền tảng thuê xe máy số 1 Đà Nẵng</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                Thuê xe máy tự lái nhanh chóng &amp; thông minh
              </h1>
              <p className="mt-2 text-sm text-slate-300/90 leading-relaxed">
                Nhận xe tận nơi trong 5 phút tại Sân bay, Ga tàu và Khách sạn. Thủ tục 100% số hóa, không giữ CCCD/Hộ chiếu gốc.
              </p>
            </div>

            {/* Thẻ minh họa xe trực quan làm nổi bật màn hình */}
            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-5 shadow-2xl relative">
              <div className="flex items-center justify-between text-xs text-teal-300 font-semibold mb-2">
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Sẵn sàng giao xe 24/7
                </span>
                <span className="text-amber-300 font-bold">★ 4.9/5 (1.200+ đánh giá)</span>
              </div>

              <div className="py-2 flex justify-center">
                <img
                  src={getAssetUrl('images/vehicles/honda-airblade.png')}
                  alt="Honda Air Blade 2024"
                  className="w-full max-w-[260px] h-36 sm:h-40 object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div className="mt-2 pt-3 border-t border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">Honda Air Blade 125cc (2024)</div>
                  <div className="text-xs text-slate-300">2 Mũ bảo hiểm cao cấp • Áo mưa • Bảo hiểm</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-teal-400">150.000 ₫</div>
                  <div className="text-[11px] text-slate-400">/ngày thuê</div>
                </div>
              </div>
            </div>

            {/* Các điểm nổi bật */}
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Xác thực CCCD &amp; Bằng lái xe tự động trong 30 giây</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Miễn phí giao nhận xe tận nơi tại trung tâm Đà Nẵng</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Cứu hộ kỹ thuật &amp; đổi xe tận nơi 24/7 khi gặp sự cố</span>
              </div>
            </div>
          </div>

          {/* Phần chân: Thông tin hỗ trợ */}
          <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-teal-400" />
              Tổng đài: <strong>1900 633 633</strong>
            </span>
            <span>Đà Nẵng &middot; Hội An</span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* CỘT PHẢI: KHUNG ĐĂNG NHẬP / TẠO TÀI KHOẢN                     */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 bg-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between">
          {/* Thanh trên cùng: Nút về trang chủ & Ngôn ngữ */}
          <div className="flex items-center justify-between mb-6">
            <Link
              to="/"
              className="text-xs font-semibold text-slate-500 hover:text-teal-700 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Về trang chủ</span>
            </Link>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
              <Globe className="w-3.5 h-3.5" />
              <span>Tiếng Việt</span>
            </div>
          </div>

          {/* Khu vực nội dung Form */}
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {activeTab === 'login' ? 'Đăng nhập vào MotoCare' : 'Tạo tài khoản mới'}
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                {activeTab === 'login'
                  ? 'Nhập địa chỉ email và mật khẩu của bạn để truy cập hệ thống'
                  : 'Đăng ký thông tin tài khoản chỉ trong 30 giây để bắt đầu thuê xe'}
              </p>
            </div>

            {/* Thanh Tab Đăng nhập / Tạo tài khoản gạch chân chuẩn mẫu */}
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className={cn(
                  'pb-3 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer',
                  activeTab === 'login'
                    ? 'border-teal-700 text-teal-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                )}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className={cn(
                  'pb-3 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer',
                  activeTab === 'register'
                    ? 'border-teal-700 text-teal-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                )}
              >
                Tạo tài khoản
              </button>
            </div>

            {/* FORM ĐĂNG NHẬP */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  label="Địa chỉ email"
                  type="email"
                  placeholder="vd: admin@motocare.vn"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />

                <Input
                  label="Mật khẩu"
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu của bạn"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      className="p-1 text-slate-400 hover:text-slate-700 focus:outline-none transition-colors cursor-pointer"
                      tabIndex={-1}
                      title={showLoginPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                    >
                      {showLoginPassword ? (
                        <EyeOff className="w-5 h-5 text-slate-600" />
                      ) : (
                        <Eye className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  }
                />

                {/* Quên mật khẩu */}
                <div className="flex justify-between items-center text-xs pt-0.5">
                  <span className="text-slate-400">Bảo mật thông tin 2 lớp</span>
                  <button
                    type="button"
                    onClick={() =>
                      toast.info('Vui lòng liên hệ tổng đài 1900 633 633 để được cấp lại mật khẩu nhanh chóng.')
                    }
                    className="text-slate-600 hover:text-teal-700 font-semibold underline underline-offset-2 cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={loading}
                  className="h-12 text-base font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-md transition-all cursor-pointer mt-2"
                >
                  Đăng nhập
                </Button>

                {/* Chuyển sang Tạo tài khoản */}
                <div className="text-center text-sm text-slate-600 pt-2">
                  Người dùng mới?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="text-teal-700 font-bold hover:underline cursor-pointer"
                  >
                    Đăng ký tài khoản
                  </button>
                </div>
              </form>
            )}

            {/* FORM ĐĂNG KÝ / TẠO TÀI KHOẢN */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3.5">
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
                  type={showRegPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu an toàn"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowRegPassword((prev) => !prev)}
                      className="p-1 text-slate-400 hover:text-slate-700 focus:outline-none transition-colors cursor-pointer"
                      tabIndex={-1}
                      title={showRegPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                    >
                      {showRegPassword ? (
                        <EyeOff className="w-5 h-5 text-slate-600" />
                      ) : (
                        <Eye className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  }
                />

                <Input
                  label="Xác nhận mật khẩu"
                  type={showRegConfirmPassword ? 'text' : 'password'}
                  placeholder="Nhập lại mật khẩu"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  required
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword((prev) => !prev)}
                      className="p-1 text-slate-400 hover:text-slate-700 focus:outline-none transition-colors cursor-pointer"
                      tabIndex={-1}
                      title={showRegConfirmPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                    >
                      {showRegConfirmPassword ? (
                        <EyeOff className="w-5 h-5 text-slate-600" />
                      ) : (
                        <Eye className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  }
                />

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={loading}
                  className="h-12 text-base font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-md transition-all cursor-pointer mt-1"
                >
                  Tạo tài khoản
                </Button>

                {/* Chuyển về Đăng nhập */}
                <div className="text-center text-sm text-slate-600 pt-1">
                  Đã có tài khoản?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('login')}
                    className="text-teal-700 font-bold hover:underline cursor-pointer"
                  >
                    Đăng nhập ngay
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Phần chân bảo mật */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Bảo mật thông tin tài khoản theo tiêu chuẩn mã hóa SSL 256-bit</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
