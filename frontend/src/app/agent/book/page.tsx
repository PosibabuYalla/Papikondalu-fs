'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, Trash2, Download, MessageCircle, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID || 'papikondalu@upi';
const MERCHANT = 'Papikondalu Tourism';
const TIMER_SECONDS = 300; // 5 minutes

// ── Schemas ───────────────────────────────────────────────────────────────────
const passengerSchema = z.object({
  name: z.string().min(2, 'Name required'),
  age: z.coerce.number().min(1).max(100),
  gender: z.enum(['Male', 'Female', 'Other']),
  aadhaarNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
});

const schema = z.object({
  packageId: z.string().min(1, 'Select a package'),
  travelDate: z.string().min(1, 'Select travel date'),
  paymentMode: z.enum(['CASH', 'ONLINE']),
  passengerEmail: z.string().email('Valid email required'),
  passengerPhone: z.string().optional(),
  passengerName: z.string().optional(),
  specialRequests: z.string().optional(),
  passengers: z.array(passengerSchema).min(1, 'At least one passenger'),
});

type FormData = z.infer<typeof schema>;

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AgentBookPage() {
  const { user } = useAuthStore();
  const [view, setView] = useState<'form' | 'payment' | 'ticket'>('form');
  const [booked, setBooked] = useState<any>(null);
  const [formVars, setFormVars] = useState<FormData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);

  // 5-minute countdown — only runs in payment view
  useEffect(() => {
    if (view !== 'payment') return;
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [view, secondsLeft]);

  // ── Packages query ─────────────────────────────────────────────────────────
  const { data: pkgRaw } = useQuery({
    queryKey: ['packages-agent'],
    queryFn: () => api.get('/packages?limit=100').then(r => r.data.data),
  });
  const packages: any[] = pkgRaw?.data ?? [];

  // ── Form ───────────────────────────────────────────────────────────────────
  const { register, control, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { paymentMode: 'CASH', passengers: [{ name: '', age: 18, gender: 'Male' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'passengers' });

  const selectedPkg = packages.find((p: any) => p.id === watch('packageId'));
  const pCount = watch('passengers').length;
  const unitPrice = selectedPkg ? Number(selectedPkg.discountedPrice || selectedPkg.price) : 0;
  const subtotal = unitPrice * pCount;
  const tax = subtotal * 0.05;
  const finalTotal = subtotal + tax;

  // ── Booking mutation ───────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/bookings/agent', data).then(r => r.data.data),
    onSuccess: (data, variables) => {
      setBooked(data);
      setFormVars(variables);
      toast.success('Booking created!');
      if (variables.paymentMode === 'ONLINE') {
        setSecondsLeft(TIMER_SECONDS);
        setView('payment');
      } else {
        setView('ticket');
      }
    },
    onError: (e: any) =>
      toast.error(!e?.response ? 'Cannot connect to server' : e?.response?.data?.message || 'Booking failed'),
  });

  // ── Derived values for payment / ticket views ──────────────────────────────
  const packageName = formVars
    ? packages.find((p: any) => p.id === formVars.packageId)?.name ?? ''
    : '';

  const upiValue = booked
    ? `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(MERCHANT)}&am=${booked.finalAmount}&cu=INR&tn=Booking+${booked.bookingNumber}`
    : '';

  const waText = booked && formVars
    ? `🎫 *Ticket – ${MERCHANT}*\n\n` +
      `📋 Booking: ${booked.bookingNumber}\n` +
      `📦 Package: ${packageName}\n` +
      `📅 Travel Date: ${format(new Date(booked.travelDate), 'dd MMM yyyy')}\n` +
      `👥 Passengers: ${booked.numberOfPersons ?? formVars.passengers.length}\n` +
      `💰 Amount: ₹${Number(booked.finalAmount).toLocaleString('en-IN')}\n` +
      `💳 Payment: ${booked.paymentMode === 'ONLINE' ? 'UPI / Online' : 'Cash'}\n\n` +
      `*Passenger Details:*\n` +
      formVars.passengers.map((p, i) => `${i + 1}. ${p.name} (${p.age} yrs, ${p.gender})`).join('\n') +
      `\n\nThank you for choosing ${MERCHANT}! 🙏`
    : '';

  const rawPhone = formVars?.passengerPhone?.replace(/\D/g, '') ?? '';
  const waUrl = `https://wa.me/${rawPhone ? '91' + rawPhone : ''}?text=${encodeURIComponent(waText)}`;

  // ── Print / PDF ────────────────────────────────────────────────────────────
  const downloadPdf = () => {
    const el = document.getElementById('printable-ticket');
    if (!el) return;
    const w = window.open('', '_blank', 'width=800,height=700');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html><head>
<title>Ticket – ${booked?.bookingNumber ?? ''}</title>
<meta charset="utf-8"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111;padding:24px}
  .ticket-header{background:#2563eb;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center}
  .ticket-body{border:2px dashed #93c5fd;border-top:none;border-radius:0 0 12px 12px;padding:24px;background:#fff}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
  .field-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
  .field-value{font-size:14px;font-weight:600;color:#111}
  hr.dashed{border:none;border-top:1px dashed #cbd5e1;margin:16px 0}
  .amount-box{background:#eff6ff;border-radius:10px;padding:16px;display:flex;justify-content:space-between;align-items:center}
  .amount-big{font-size:26px;font-weight:700;color:#1d4ed8}
  .footer{text-align:center;font-size:11px;color:#94a3b8;margin-top:16px}
  .status-badge{background:#22c55e;color:#fff;font-size:11px;padding:2px 8px;border-radius:99px;font-weight:600}
  .booking-num{font-family:monospace;font-size:20px;font-weight:700}
  @media print{body{padding:0}button{display:none}}
</style>
</head><body>
<div class="ticket-header">
  <div>
    <div style="font-size:18px;font-weight:700">${MERCHANT}</div>
    <div style="font-size:12px;opacity:.8">Official Booking Ticket</div>
  </div>
  <div style="text-align:right">
    <div class="booking-num">${booked?.bookingNumber ?? ''}</div>
    <span class="status-badge">${booked?.status ?? ''}</span>
  </div>
</div>
<div class="ticket-body">
  <div class="grid2">
    <div><div class="field-label">Package</div><div class="field-value">${packageName}</div></div>
    <div><div class="field-label">Travel Date</div><div class="field-value">${booked?.travelDate ? format(new Date(booked.travelDate), 'dd MMM yyyy') : '—'}</div></div>
    <div><div class="field-label">Total Passengers</div><div class="field-value">${booked?.numberOfPersons ?? formVars?.passengers.length ?? 0}</div></div>
    <div><div class="field-label">Payment Mode</div><div class="field-value">${booked?.paymentMode === 'ONLINE' ? 'UPI / Online' : 'Cash'}</div></div>
  </div>
  <hr class="dashed"/>
  <div style="margin-bottom:16px">
    <div class="field-label" style="margin-bottom:8px">Passengers</div>
    ${formVars?.passengers.map((p, i) => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span>${i + 1}. ${p.name}</span><span style="color:#64748b">${p.age} yrs · ${p.gender}</span></div>`).join('') ?? ''}
  </div>
  <hr class="dashed"/>
  <div class="amount-box">
    <div>
      <div class="field-label">Total Amount Paid</div>
      <div class="amount-big">₹${Number(booked?.finalAmount ?? 0).toLocaleString('en-IN')}</div>
    </div>
  </div>
  <div class="footer">
    Booked by Agent: <strong>${user?.name ?? ''}</strong> · ${format(new Date(), 'dd MMM yyyy, HH:mm')}<br/>
    Thank you for choosing ${MERCHANT}! 🙏
  </div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
    w.document.close();
  };

  const resetAll = () => {
    setView('form');
    setBooked(null);
    setFormVars(null);
    setSecondsLeft(TIMER_SECONDS);
    reset();
  };

  // ── Payment QR View ───────────────────────────────────────────────────────
  if (view === 'payment') {
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const expired = secondsLeft === 0;

    return (
      <div className="max-w-sm mx-auto py-8 space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold">UPI Payment</h1>
          <p className="text-muted-foreground text-sm mt-1">Show QR to the passenger to scan & pay</p>
        </div>

        {/* QR card */}
        <div className="bg-card border rounded-2xl p-6 flex flex-col items-center gap-4">
          <div className="bg-white rounded-xl p-3 shadow-inner">
            <QRCodeSVG value={upiValue} size={200} level="M" includeMargin={false} />
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">₹{Number(booked?.finalAmount).toLocaleString('en-IN')}</p>
            <p className="text-sm text-muted-foreground mt-0.5">Booking #{booked?.bookingNumber}</p>
          </div>
          <div className="text-xs text-center text-muted-foreground">
            UPI ID: <span className="font-mono font-semibold">{UPI_ID}</span>
          </div>
        </div>

        {/* Countdown */}
        <div className={`flex items-center justify-center gap-2 text-xl font-mono font-bold ${
          expired ? 'text-red-500' : secondsLeft < 60 ? 'text-orange-500' : 'text-green-600'
        }`}>
          <Clock className="w-5 h-5" />
          {expired
            ? 'Timer expired'
            : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} remaining`}
        </div>

        {expired && (
          <p className="text-sm text-center text-orange-600 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-xl p-3">
            Payment window expired. Confirm with the passenger before proceeding.
          </p>
        )}

        <button
          onClick={() => setView('ticket')}
          className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-5 h-5" />
          Payment Done — View Ticket
        </button>
      </div>
    );
  }

  // ── Ticket View ───────────────────────────────────────────────────────────
  if (view === 'ticket') {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Action bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">Booking Ticket</h1>
          <div className="flex gap-2">
            <button
              onClick={downloadPdf}
              className="flex items-center gap-2 px-4 py-2 bg-godavari-600 text-white rounded-xl text-sm font-semibold hover:bg-godavari-700 transition-colors"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-xl text-sm font-semibold hover:bg-[#1ebe5b] transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          </div>
        </div>

        {/* Ticket card */}
        <div id="printable-ticket" className="bg-card rounded-2xl overflow-hidden border-2 border-dashed border-godavari-300 dark:border-godavari-700">
          {/* Header */}
          <div className="bg-godavari-600 text-white px-6 py-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">{MERCHANT}</h2>
              <p className="text-godavari-200 text-xs mt-0.5">Official Booking Ticket</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xl font-bold">{booked?.bookingNumber}</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-500 text-white">
                {booked?.status}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Trip info grid */}
            <div className="grid grid-cols-2 gap-4">
              <TicketField label="Package" value={packageName} />
              <TicketField label="Travel Date" value={booked?.travelDate ? format(new Date(booked.travelDate), 'dd MMM yyyy') : '—'} />
              <TicketField label="Passengers" value={String(booked?.numberOfPersons ?? formVars?.passengers.length ?? 0)} />
              <TicketField label="Payment Mode" value={booked?.paymentMode === 'ONLINE' ? 'UPI / Online' : 'Cash'} />
            </div>

            <hr className="border-dashed border-muted-foreground/30" />

            {/* Passenger list */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Passenger Details</p>
              <div className="space-y-1.5">
                {formVars?.passengers.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="font-medium">{i + 1}. {p.name}</span>
                    <span className="text-muted-foreground">{p.age} yrs · {p.gender}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact info */}
            {(formVars?.passengerName || formVars?.passengerEmail || formVars?.passengerPhone) && (
              <>
                <hr className="border-dashed border-muted-foreground/30" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contact</p>
                  <div className="grid grid-cols-2 gap-3">
                    {formVars?.passengerName && <TicketField label="Name" value={formVars.passengerName} />}
                    {formVars?.passengerEmail && <TicketField label="Email" value={formVars.passengerEmail} />}
                    {formVars?.passengerPhone && <TicketField label="Phone" value={formVars.passengerPhone} />}
                  </div>
                </div>
              </>
            )}

            <hr className="border-dashed border-muted-foreground/30" />

            {/* Amount + optional mini QR */}
            <div className="bg-godavari-50 dark:bg-godavari-950 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Amount Paid</p>
                <p className="text-3xl font-bold text-godavari-700 dark:text-godavari-300">
                  ₹{Number(booked?.finalAmount ?? 0).toLocaleString('en-IN')}
                </p>
              </div>
              {booked?.paymentMode === 'ONLINE' && upiValue && (
                <div className="bg-white rounded-xl p-2 shrink-0">
                  <QRCodeSVG value={upiValue} size={72} level="M" includeMargin={false} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground pt-1">
              <p>Booked by Agent: <strong>{user?.name}</strong> · {format(new Date(), 'dd MMM yyyy, HH:mm')}</p>
              <p className="mt-1">Thank you for choosing {MERCHANT} 🙏</p>
            </div>
          </div>
        </div>

        {/* Nav actions */}
        <div className="flex gap-3">
          <button onClick={resetAll} className="flex-1 border rounded-xl py-2.5 text-sm font-medium hover:bg-muted transition-colors">
            Book Another
          </button>
          <a href="/agent/bookings" className="flex-1 border rounded-xl py-2.5 text-sm font-medium hover:bg-muted transition-colors text-center">
            View All Bookings
          </a>
        </div>
      </div>
    );
  }

  // ── Form View ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Book Ticket</h1>
        <p className="text-muted-foreground text-sm">Book a ticket on behalf of a walk-in passenger.</p>
      </div>

      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-6">
        {/* Package & Date */}
        <div className="bg-card border rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold">Trip Details</h2>
          <div>
            <label className="text-sm font-medium">Package <span className="text-red-500">*</span></label>
            <select {...register('packageId')} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background">
              <option value="">Select a package…</option>
              {packages.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ₹{Number(p.discountedPrice || p.price).toLocaleString('en-IN')} / person ({p.availableSeats} seats)
                </option>
              ))}
            </select>
            {errors.packageId && <p className="text-red-500 text-xs mt-1">{errors.packageId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Travel Date <span className="text-red-500">*</span></label>
              <input type="date" {...register('travelDate')} min={format(new Date(), 'yyyy-MM-dd')}
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background" />
              {errors.travelDate && <p className="text-red-500 text-xs mt-1">{errors.travelDate.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Payment Mode</label>
              <select {...register('paymentMode')} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background">
                <option value="CASH">Cash</option>
                <option value="ONLINE">Online / UPI</option>
              </select>
            </div>
          </div>
        </div>

        {/* Passenger contact */}
        <div className="bg-card border rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold">Passenger Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Full Name</label>
              <input {...register('passengerName')} placeholder="Contact person name"
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background" />
            </div>
            <div>
              <label className="text-sm font-medium">Email <span className="text-red-500">*</span></label>
              <input type="email" {...register('passengerEmail')} placeholder="passenger@email.com"
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background" />
              {errors.passengerEmail && <p className="text-red-500 text-xs mt-1">{errors.passengerEmail.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Phone (for WhatsApp)</label>
              <input {...register('passengerPhone')} placeholder="+91 XXXXX XXXXX"
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background" />
            </div>
          </div>
        </div>

        {/* Passengers */}
        <div className="bg-card border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Passengers</h2>
            <button type="button" onClick={() => append({ name: '', age: 18, gender: 'Male' })}
              className="flex items-center gap-1 text-sm text-godavari-600 hover:underline">
              <Plus className="w-4 h-4" /> Add Passenger
            </button>
          </div>
          {fields.map((field, i) => (
            <div key={field.id} className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Passenger {i + 1}</span>
                {i > 0 && (
                  <button type="button" onClick={() => remove(i)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">
                  <label className="text-xs text-muted-foreground">Name *</label>
                  <input {...register(`passengers.${i}.name`)} placeholder="Full name"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                  {errors.passengers?.[i]?.name && <p className="text-red-500 text-xs mt-0.5">{errors.passengers[i]?.name?.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Age *</label>
                  <input type="number" {...register(`passengers.${i}.age`)} min={1} max={100}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Gender *</label>
                  <select {...register(`passengers.${i}.gender`)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Aadhaar (optional)</label>
                  <input {...register(`passengers.${i}.aadhaarNumber`)} placeholder="XXXX XXXX XXXX"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Emergency Contact</label>
                  <input {...register(`passengers.${i}.emergencyContact`)} placeholder="Phone"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
              </div>
            </div>
          ))}
          {errors.passengers?.root && <p className="text-red-500 text-xs">{errors.passengers.root.message}</p>}
        </div>

        {/* Special requests */}
        <div className="bg-card border rounded-2xl p-5">
          <label className="text-sm font-medium">Special Requests (optional)</label>
          <textarea {...register('specialRequests')} rows={2} placeholder="Any special requirements…"
            className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-background resize-none" />
        </div>

        {/* Price summary */}
        {selectedPkg && (
          <div className="bg-card border rounded-2xl p-5 space-y-2 text-sm">
            <h2 className="font-semibold mb-3">Price Summary</h2>
            <div className="flex justify-between text-muted-foreground">
              <span>₹{unitPrice.toLocaleString('en-IN')} × {pCount} passenger{pCount > 1 ? 's' : ''}</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>GST (5%)</span>
              <span>₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t">
              <span>Total</span>
              <span>₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}

        {watch('paymentMode') === 'ONLINE' && (
          <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
            <span>💳</span>
            <span>A UPI payment QR will be shown after booking for the passenger to scan. You have <strong>5 minutes</strong> to complete payment.</span>
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full py-3 bg-godavari-600 text-white rounded-xl font-semibold hover:bg-godavari-700 disabled:opacity-60 transition-colors"
        >
          {mutation.isPending ? 'Creating Booking…' : 'Confirm Booking'}
        </button>
      </form>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function TicketField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm mt-0.5">{value}</p>
    </div>
  );
}
