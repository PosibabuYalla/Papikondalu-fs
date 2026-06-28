'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, _hasHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (user && user.role === 'USER') { router.push('/dashboard'); return; }
    if (user && user.role === 'AGENT') { router.push('/agent/dashboard'); }
  }, [_hasHydrated, isAuthenticated, user]);

  if (!_hasHydrated || !isAuthenticated || !user || user.role === 'USER' || user.role === 'AGENT') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-godavari-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <AdminSidebar />
      <div className="flex-1 lg:ml-64 min-h-screen">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b h-14 flex items-center px-6">
          <span className="font-semibold text-sm text-muted-foreground">Admin Panel</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-godavari-500 flex items-center justify-center text-white text-xs font-bold">
              {user.name?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-medium hidden sm:block">{user.name}</span>
          </div>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
