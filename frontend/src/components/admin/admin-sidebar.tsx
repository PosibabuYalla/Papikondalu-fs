'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Package, Calendar, Users, Star, BarChart3,
  CreditCard, Anchor, LogOut, Menu, X, MessageSquare, UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useLogout } from '@/hooks/useAuth';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { href: '/admin/packages', label: 'Packages', icon: Package, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { href: '/admin/bookings', label: 'Bookings', icon: Calendar, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { href: '/admin/users', label: 'Users', icon: Users, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { href: '/admin/agents', label: 'Agents', icon: UserCog, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { href: '/admin/reviews', label: 'Reviews', icon: Star, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { href: '/admin/contacts', label: 'Contacts', icon: MessageSquare, roles: ['ADMIN', 'SUPER_ADMIN'] },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const logout = useLogout();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-card border rounded-lg shadow-sm"
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r flex flex-col transition-transform duration-300',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="p-5 border-b flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <Anchor className="w-5 h-5 text-godavari-500" />
            <div>
              <p className="text-sm leading-tight">Papikondalu</p>
              <p className="text-xs text-muted-foreground leading-tight">Admin Panel</p>
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.filter(item => !item.roles || item.roles.includes(user?.role ?? '')).map(({ href, label, icon: Icon }) => (
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
            <p className="font-medium">{user?.name}</p>
            <p>{user?.role}</p>
          </div>
          <button
            onClick={() => logout.mutate()}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
