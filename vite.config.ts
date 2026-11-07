import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const isVercel = process.env.VERCEL === '1';

// Tự động phân giải đường dẫn gốc:
// - GitHub Pages: tự động lấy subpath từ GITHUB_REPOSITORY (hoặc fallback '/web-moto-care/')
// - Vercel / Tên miền riêng: chạy trên root '/'
// - Môi trường nội bộ / file preview: './'
const repoSubpath = process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
  : '/web-moto-care/';
const basePath = isGitHubActions ? repoSubpath : isVercel ? '/' : './';

// https://vitejs.dev/config/
export default defineConfig({
  // Chỉ quét entry của ứng dụng; không quét các bản sao lưu và bộ công cụ cục bộ.
  optimizeDeps: { entries: ['index.html'] },
  server: { host: '127.0.0.1', watch: { ignored: ['**/.agent/**', '**/.codex-backups/**', '**/.codex-upstream/**'] } },
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'db-vendor': ['dexie', 'dexie-react-hooks', '@supabase/supabase-js'],
          'ui-vendor': ['lucide-react', 'clsx', 'tailwind-merge'],
          'utils-vendor': ['date-fns', 'qrcode', 'zod', 'zustand'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/unit/setup.ts',
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
