'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { format } from 'date-fns';
import { Search, Ticket } from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  REFUNDED: 'bg-purple-100 text-purple-700',
};

export default function AgentBookingsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['agent-bookings-list', page],
    queryFn: () => api.get(`/bookings/agent/my?page=${page}&limit=15`).then(r => r.data.data),
  });

  const bookings: any[] = data?.data ?? [];
  const meta = data?.meta;

  const filtered = search
    ? bookings.filter(b =>
        b.bookingNumber.toLowerCase().includes(search.toLowerCase()) ||
        b.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.package?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : bookings;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Bookings</h1>
          <p className="text-muted-foreground text-sm">All tickets you have booked for passengers.</p>
        </div>
        <Link
          href="/agent/book"
          className="flex items-center gap-2 bg-godavari-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-godavari-700 transition-colors"
        >
          <Ticket className="w-4 h-4" /> Book Ticket
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search bookings…"
          className="pl-9 pr-3 py-2 text-sm border rounded-xl w-full bg-background"
        />
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading bookings…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Ticket className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No bookings found.</p>
            <Link href="/agent/book" className="mt-3 inline-block text-sm text-godavari-600 hover:underline">
              Book a ticket now
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Booking #</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Passenger</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Package</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Travel Date</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Persons</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Payment</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Booked On</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((b: any) => (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs font-semibold">{b.bookingNumber}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium">{b.user?.name}</p>
                        <p className="text-xs text-muted-foreground">{b.user?.email}</p>
                      </td>
                      <td className="px-5 py-3">{b.package?.name}</td>
                      <td className="px-5 py-3">{format(new Date(b.travelDate), 'dd MMM yyyy')}</td>
                      <td className="px-5 py-3 text-center">{b.numberOfPersons}</td>
                      <td className="px-5 py-3 font-medium">₹{Number(b.finalAmount).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.paymentMode === 'CASH' ? 'bg-orange-100 text-orange-700' : 'bg-sky-100 text-sky-700'}`}>
                          {b.paymentMode ?? 'CASH'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.status] ?? 'bg-muted'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {format(new Date(b.createdAt), 'dd MMM yyyy, HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t text-sm">
                <span className="text-muted-foreground">
                  {meta.total} bookings · Page {meta.page} of {meta.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={!meta.hasPrev}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1 border rounded-lg disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    disabled={!meta.hasNext}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1 border rounded-lg disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
