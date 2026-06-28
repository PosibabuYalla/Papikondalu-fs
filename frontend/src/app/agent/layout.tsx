'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { Anchor, LayoutDashboard, Ticket, ClipboardList, LogOut, Menu, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/agent/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agent/book', label: 'Book Ticket', icon: Ticket },
  { href: '/agent/bookings', label: 'My Bookings', icon: ClipboardList },
];

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (user && user.role !== 'AGENT') {
      router.push(user.role === 'USER' ? '/dashboard' : '/admin/dashboard');
    }
  }, [_hasHydrated, isAuthenticated, user]);

  if (!_hasHydrated || !isAuthenticated || !user || user.role !== 'AGENT') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-godavari-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Mobile menu button */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-card border rounded-lg shadow-sm"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r flex flex-col transition-transform duration-300',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="p-5 border-b flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <Anchor className="w-5 h-5 text-godavari-500" />
            <div>
              <p className="text-sm leading-tight">Papikondalu</p>
              <p className="text-xs text-muted-foreground leading-tight">Agent Portal</p>
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                pathname.startsWith(href)
                  ? 'bg-godavari-50 dark:bg-godavari-950 text-godavari-600'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t space-y-1">
          <div className="px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium">{user.name}</p>
            <p className="text-godavari-500">Agent</p>
          </div>
          <button
            onClick={() => logout.mutate()}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 min-h-screen">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b h-14 flex items-center px-6">
          <span className="font-semibold text-sm text-muted-foreground">Agent Portal</span>
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
