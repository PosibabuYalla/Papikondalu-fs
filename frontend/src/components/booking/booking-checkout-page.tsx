'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, User, Loader2, ChevronRight, CreditCard, Building2, Smartphone, ShieldCheck } from 'lucide-react';
import { usePackage } from '@/hooks/usePackages';
import { useCreateBooking } from '@/hooks/useBookings';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const passengerSchema = z.object({
  name: z.string().min(2, 'Required'),
  age: z.coerce.number().min(1).max(100),
  gender: z.string().min(1, 'Required'),
  aadhaarNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
});

const schema = z.object({
  travelDate: z.string().min(1, 'Select travel date'),
  passengers: z.array(passengerSchema).min(1),
  specialRequests: z.string().optional(),
});

type Form = z.infer<typeof schema>;
type PaymentMethod = 'gpay' | 'phonepe' | 'paytm_upi' | 'upi' | 'credit_card' | 'debit_card' | 'netbanking';

const PAYMENT_GROUPS = [
  {
    label: 'UPI Apps',
    icon: Smartphone,
    methods: [
      { id: 'gpay' as PaymentMethod, label: 'Google Pay', bg: '#E8F0FE', color: '#1a73e8', short: 'G Pay' },
      { id: 'phonepe' as PaymentMethod, label: 'PhonePe', bg: '#EDE7F6', color: '#5F259F', short: 'Pe' },
      { id: 'paytm_upi' as PaymentMethod, label: 'Paytm UPI', bg: '#E3F2FD', color: '#00BAF2', short: 'Pay' },
      { id: 'upi' as PaymentMethod, label: 'Other UPI', bg: '#E8F5E9', color: '#2E7D32', short: 'UPI' },
    ],
  },
  {
    label: 'Cards',
    icon: CreditCard,
    methods: [
      { id: 'credit_card' as PaymentMethod, label: 'Credit Card', bg: '#FFF3E0', color: '#E65100', short: 'CC' },
      { id: 'debit_card' as PaymentMethod, label: 'Debit Card', bg: '#E0F2F1', color: '#00695C', short: 'DC' },
    ],
  },
  {
    label: 'Net Banking',
    icon: Building2,
    methods: [
      { id: 'netbanking' as PaymentMethod, label: 'Net Banking', bg: '#FCE4EC', color: '#AD1457', short: 'NB' },
    ],
  },
];

function buildRazorpayDisplay(method: PaymentMethod) {
  switch (method) {
    case 'gpay':
      return { blocks: { apps: { name: 'Google Pay', instruments: [{ method: 'upi', flows: ['intent'], apps: ['google_pay'] }] } }, sequence: ['block.apps'], preferences: { show_default_blocks: false } };
    case 'phonepe':
      return { blocks: { apps: { name: 'PhonePe', instruments: [{ method: 'upi', flows: ['intent'], apps: ['phonepe'] }] } }, sequence: ['block.apps'], preferences: { show_default_blocks: false } };
    case 'paytm_upi':
      return { blocks: { apps: { name: 'Paytm UPI', instruments: [{ method: 'upi', flows: ['intent'], apps: ['paytm'] }] } }, sequence: ['block.apps'], preferences: { show_default_blocks: false } };
    case 'upi':
      return { blocks: { upi: { name: 'Pay via UPI', instruments: [{ method: 'upi' }] } }, sequence: ['block.upi'], preferences: { show_default_blocks: false } };
    case 'credit_card':
    case 'debit_card':
      return { blocks: { card: { name: 'Pay via Card', instruments: [{ method: 'card' }] } }, sequence: ['block.card'], preferences: { show_default_blocks: false } };
    case 'netbanking':
      return { blocks: { nb: { name: 'Net Banking', instruments: [{ method: 'netbanking' }] } }, sequence: ['block.nb'], preferences: { show_default_blocks: false } };
  }
}

export function BookingCheckoutPage({ packageId }: { packageId: string }) {
  const router = useRouter();
  const { data: pkg, isLoading } = usePackage(packageId);
  const createBooking = useCreateBooking();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState<'details' | 'payment'>('details');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [payingWith, setPayingWith] = useState<PaymentMethod | null>(null);

  const { register, handleSubmit, watch, control, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { passengers: [{ name: '', age: 18, gender: 'Male' }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'passengers' });
  const passengers = watch('passengers');
  const unitPrice = pkg ? Number(pkg.discountedPrice || pkg.price) : 0;
  const subtotal = unitPrice * passengers.length;
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  const onSubmit = async (data: Form) => {
    const result = await createBooking.mutateAsync({ packageId, ...data });
    setBookingId(result.id);
    setStep('payment');
  };

  const loadRazorpayScript = (): Promise<void> =>
    new Promise((resolve, reject) => {
      if ((window as any).Razorpay) return resolve();
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.body.appendChild(script);
    });

  const initiatePayment = async (method: PaymentMethod) => {
    if (!bookingId) return;
    setPayingWith(method);
    try {
      await loadRazorpayScript();
      const { data: res } = await api.post(`/payments/create-order/${bookingId}`);
      const order = res.data;
      const display = buildRazorpayDisplay(method);
      const options: any = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'Papikondalu Tourism',
        description: pkg?.name,
        image: '/images/logo.png',
        order_id: order.orderId,
        handler: async (response: any) => {
          try {
            await api.post('/payments/verify', response);
            router.push(`/booking/success?bookingId=${bookingId}`);
          } catch {
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: user?.name ?? '',
          email: user?.email ?? '',
          contact: user?.phone ?? '',
        },
        config: { display },
        modal: { ondismiss: () => { toast('Payment cancelled'); setPayingWith(null); } },
        theme: { color: '#0087fb' },
      };
      const rp = new (window as any).Razorpay(options);
      rp.on('payment.failed', (resp: any) => {
        toast.error(`Payment failed: ${resp.error.description}`);
        setPayingWith(null);
      });
      rp.open();
    } catch {
      toast.error('Failed to create payment order');
      setPayingWith(null);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen pt-20 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-godavari-500" />
    </div>
  );

  if (!pkg) return (
    <div className="min-h-screen pt-20 flex items-center justify-center">
      <p>Package not found</p>
    </div>
  );

  return (
    <div className="min-h-screen pt-20 pb-10">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Steps */}
        <div className="flex items-center gap-3 mb-8">
          {['details', 'payment'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === s || (i === 0 && step === 'payment') ? 'bg-godavari-500 text-white' : 'bg-muted text-muted-foreground'}`}>{i + 1}</div>
              <span className="capitalize text-sm font-medium hidden sm:block">{s}</span>
              {i === 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {step === 'details' ? (
                <motion.form
                  key="details"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  {/* Travel Date */}
                  <div className="bg-card rounded-2xl border p-6 space-y-4">
                    <h2 className="text-lg font-semibold">Travel Date</h2>
                    <div>
                      <input
                        type="date"
                        {...register('travelDate')}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-3 border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-godavari-500"
                      />
                      {errors.travelDate && <p className="text-red-500 text-xs mt-1">{errors.travelDate.message}</p>}
                    </div>
                  </div>

                  {/* Passengers */}
                  <div className="bg-card rounded-2xl border p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold">Passenger Details</h2>
                      <button
                        type="button"
                        onClick={() => append({ name: '', age: 18, gender: 'Male' })}
                        disabled={fields.length >= (pkg.availableSeats || 10)}
                        className="flex items-center gap-1 text-sm text-godavari-500 hover:text-godavari-700 disabled:opacity-40"
                      >
                        <Plus className="w-4 h-4" /> Add Passenger
                      </button>
                    </div>

                    {fields.map((field, index) => (
                      <div key={field.id} className="p-4 border rounded-xl space-y-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-godavari-500" />
                            <span className="text-sm font-medium">Passenger {index + 1}</span>
                          </div>
                          {index > 0 && (
                            <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium block mb-1">Full Name *</label>
                            <input {...register(`passengers.${index}.name`)} placeholder="Name" className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-godavari-500" />
                            {errors.passengers?.[index]?.name && <p className="text-red-500 text-xs mt-0.5">{errors.passengers[index]?.name?.message}</p>}
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1">Age *</label>
                            <input {...register(`passengers.${index}.age`)} type="number" placeholder="Age" className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-godavari-500" />
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1">Gender *</label>
                            <select {...register(`passengers.${index}.gender`)} className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-godavari-500">
                              <option>Male</option><option>Female</option><option>Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1">Aadhaar (optional)</label>
                            <input {...register(`passengers.${index}.aadhaarNumber`)} placeholder="XXXX XXXX XXXX" className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-godavari-500" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-xs font-medium block mb-1">Emergency Contact (optional)</label>
                            <input {...register(`passengers.${index}.emergencyContact`)} placeholder="+91 XXXXX XXXXX" className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-godavari-500" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Special Requests */}
                  <div className="bg-card rounded-2xl border p-6">
                    <h2 className="text-lg font-semibold mb-3">Special Requests</h2>
                    <textarea
                      {...register('specialRequests')}
                      rows={3}
                      placeholder="Any special requirements or dietary needs..."
                      className="w-full px-4 py-3 border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-godavari-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={createBooking.isPending}
                    className="w-full py-4 bg-godavari-500 text-white rounded-xl font-semibold hover:bg-godavari-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {createBooking.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Continue to Payment
                  </button>
                </motion.form>
              ) : (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {/* Header */}
                  <div className="bg-card rounded-2xl border p-5">
                    <div className="flex items-center gap-3 mb-1">
                      <ShieldCheck className="w-5 h-5 text-green-500" />
                      <h2 className="text-lg font-bold">Secure Payment</h2>
                    </div>
                    <p className="text-sm text-muted-foreground ml-8">Choose your preferred payment method</p>
                    <div className="mt-3 ml-8 p-3 bg-muted/60 rounded-xl flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount to pay</span>
                      <span className="font-bold text-godavari-600 text-base">{formatCurrency(total)}</span>
                    </div>
                  </div>

                  {/* Payment method groups */}
                  {PAYMENT_GROUPS.map((group) => {
                    const Icon = group.icon;
                    return (
                      <div key={group.label} className="bg-card rounded-2xl border p-5 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                          <Icon className="w-4 h-4" />
                          {group.label}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {group.methods.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => initiatePayment(m.id)}
                              disabled={payingWith !== null}
                              className="relative flex items-center gap-3 p-3 rounded-xl border-2 border-transparent hover:border-godavari-400 hover:bg-godavari-50 dark:hover:bg-godavari-950/30 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed group"
                            >
                              {/* Logo badge */}
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                                style={{ background: m.bg, color: m.color }}
                              >
                                {payingWith === m.id
                                  ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: m.color }} />
                                  : m.short}
                              </div>
                              <span className="text-sm font-medium leading-tight">{m.label}</span>
                              <ChevronRight className="w-4 h-4 text-muted-foreground absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Trust badges */}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground px-1">
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-green-500" /> 256-bit SSL secured</span>
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-green-500" /> PCI DSS compliant</span>
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-green-500" /> Powered by Razorpay</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary */}
          <div>
            <div className="sticky top-24 bg-card rounded-2xl border p-5 space-y-4">
              <h3 className="font-semibold">Booking Summary</h3>
              <div className="p-3 bg-muted/50 rounded-xl">
                <p className="font-medium text-sm">{pkg.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{pkg.duration} · {pkg.startingPoint}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">× {passengers.length} passenger{passengers.length > 1 ? 's' : ''}</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST (5%)</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>Total</span>
                  <span className="text-godavari-600">{formatCurrency(total)}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t">
                <p>✓ Instant confirmation</p>
                <p>✓ Free cancellation (48h)</p>
                <p>✓ UPI · GPay · PhonePe · Paytm</p>
                <p>✓ Net Banking · All banks supported</p>
                <p>✓ Debit Card · Credit Card</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
