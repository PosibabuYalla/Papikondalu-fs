'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { Ticket, CheckCircle, Clock, XCircle, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-card border rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function AgentDashboardPage() {
  const { user } = useAuthStore();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['agent-bookings'],
    queryFn: () => api.get('/bookings/agent/my?page=1&limit=100').then(r => r.data.data),
  });

  const allBookings = bookings?.data ?? [];
  const confirmed = allBookings.filter((b: any) => b.status === 'CONFIRMED').length;
  const pending = allBookings.filter((b: any) => b.status === 'PENDING').length;
  const cancelled = allBookings.filter((b: any) => b.status === 'CANCELLED').length;
  const totalRevenue = allBookings.reduce((sum: number, b: any) => sum + Number(b.finalAmount), 0);

  const recent = allBookings.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user?.name}</h1>
        <p className="text-muted-foreground text-sm">Here's a summary of your bookings.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Ticket} label="Total Bookings" value={allBookings.length} color="bg-godavari-500" />
        <StatCard icon={CheckCircle} label="Confirmed" value={confirmed} color="bg-green-500" />
        <StatCard icon={Clock} label="Pending" value={pending} color="bg-yellow-500" />
        <StatCard icon={TrendingUp} label="Total Revenue" value={`₹${totalRevenue.toLocaleString('en-IN')}`} color="bg-blue-500" />
      </div>

      <div className="bg-card border rounded-2xl">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold">Recent Bookings</h2>
          <Link href="/agent/bookings" className="text-sm text-godavari-600 hover:underline">View all</Link>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No bookings yet.{' '}
            <Link href="/agent/book" className="text-godavari-600 hover:underline">Book your first ticket</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Booking #</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Passenger</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Package</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Travel Date</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.map((b: any) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs">{b.bookingNumber}</td>
                    <td className="px-5 py-3">{b.user?.name}</td>
                    <td className="px-5 py-3">{b.package?.name}</td>
                    <td className="px-5 py-3">{format(new Date(b.travelDate), 'dd MMM yyyy')}</td>
                    <td className="px-5 py-3">₹{Number(b.finalAmount).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-godavari-50 dark:bg-godavari-950 border border-godavari-200 dark:border-godavari-800 rounded-2xl p-5">
        <h3 className="font-semibold text-godavari-800 dark:text-godavari-200 mb-1">Quick Action</h3>
        <p className="text-sm text-godavari-700 dark:text-godavari-300 mb-3">
          Has a passenger walked in? Book their ticket instantly.
        </p>
        <Link
          href="/agent/book"
          className="inline-flex items-center gap-2 bg-godavari-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-godavari-700 transition-colors"
        >
          <Ticket className="w-4 h-4" /> Book a Ticket
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    CONFIRMED: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    CANCELLED: 'bg-red-100 text-red-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
    REFUNDED: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}
