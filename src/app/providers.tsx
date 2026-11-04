// src/app/providers.tsx
import React, { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { ToastContainer } from '@/components/ui';
import { DevPanel } from '@/components/DevPanel';
import { useAuthStore } from '@/features/auth/authStore';
import { db } from '@/db';
import { seedDatabase } from '@/db/seed';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    async function initApp() {
      try {
        const count = await db.auth_accounts.count();
        if (count === 0) {
          await seedDatabase();
        }
      } catch (err) {
        console.error('Auto seed check error:', err);
      }
      await restoreSession();
    }
    initApp();
  }, [restoreSession]);

  return (
    <HashRouter>
      {children}
      <ToastContainer />
      <DevPanel />
    </HashRouter>
  );
}
