'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { Loader2 } from 'lucide-react';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.push('/login');
  }, [_hasHydrated, isAuthenticated]);

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-godavari-500" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}
