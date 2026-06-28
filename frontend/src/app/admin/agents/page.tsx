'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { format } from 'date-fns';
import {
  UserPlus, Edit2, Power, X, ChevronDown, ChevronUp,
  Ticket, TrendingUp, Users, CheckCircle, Eye, EyeOff, Copy, KeyRound,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Agent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  totalBookings: number;
  totalRevenue: number;
}

interface AgentBooking {
  id: string;
  bookingNumber: string;
  travelDate: string;
  numberOfPersons: number;
  finalAmount: number;
  status: string;
  paymentMode: string;
  user: { name: string; email: string };
  package: { name: string };
  createdAt: string;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────
const emptyToUndefined = z.string().transform(v => v === '' ? undefined : v);

const createSchema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  phone: emptyToUndefined.optional(),
  password: z.string().min(6, 'Minimum 6 characters'),
});

const editSchema = z.object({
  name: z.string().min(2).optional(),
  phone: emptyToUndefined.optional(),
  password: emptyToUndefined.pipe(z.string().min(6).optional()).optional(),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  REFUNDED: 'bg-purple-100 text-purple-700',
};

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminAgentsPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [viewCredentials, setViewCredentials] = useState<Agent | null>(null);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: () => api.get('/admin/agents?page=1&limit=100').then(r => r.data.data),
  });

  const { data: expandedData, isLoading: loadingBookings } = useQuery({
    queryKey: ['agent-bookings-admin', expandedAgent],
    queryFn: () => api.get(`/admin/agents/${expandedAgent}/bookings?page=1&limit=50`).then(r => r.data.data),
    enabled: !!expandedAgent,
  });

  const agents: Agent[] = agentsData?.data ?? [];
  const totalAgents = agents.length;
  const activeAgents = agents.filter(a => a.isActive).length;
  const totalBookings = agents.reduce((s, a) => s + (a.totalBookings ?? 0), 0);
  const totalRevenue = agents.reduce((s, a) => s + Number(a.totalRevenue ?? 0), 0);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreateForm) => api.post('/admin/agents', data).then(r => r.data.data),
    onSuccess: (_, variables) => {
      toast.success('Agent created successfully');
      setShowCreate(false);
      setLastCreated({ email: variables.email, password: variables.password });
      createForm.reset();
      qc.invalidateQueries({ queryKey: ['admin-agents'] });
    },
    onError: (e: any) => toast.error(!e?.response ? 'Cannot connect to server' : e?.response?.data?.message || 'Failed to create agent'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditForm }) =>
      api.patch(`/admin/agents/${id}`, data).then(r => r.data.data),
    onSuccess: () => {
      toast.success('Agent updated');
      setEditAgent(null);
      qc.invalidateQueries({ queryKey: ['admin-agents'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/agents/${id}`, { isActive }).then(r => r.data.data),
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? 'Agent activated' : 'Agent deactivated');
      qc.invalidateQueries({ queryKey: ['admin-agents'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  // ── Forms ──────────────────────────────────────────────────────────────────
  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema) });
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  const openEdit = (agent: Agent) => {
    setEditAgent(agent);
    editForm.reset({ name: agent.name, phone: agent.phone ?? '', password: '' });
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Last-created credentials banner ─────────────────────────────── */}
      {lastCreated && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-2xl p-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-green-800 dark:text-green-200">Agent created — share these credentials</p>
            <div className="flex flex-wrap gap-4 mt-2">
              <CredField label="Login Email" value={lastCreated.email} />
              <CredField label="Password" value={lastCreated.password} secret />
            </div>
          </div>
          <button onClick={() => setLastCreated(null)} className="shrink-0 text-green-600 hover:text-green-800 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground text-sm">Manage agent accounts and track their booking performance.</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => { setShowCreate(true); createForm.reset(); }}
            className="flex items-center gap-2 bg-godavari-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-godavari-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Add Agent
          </button>
        )}
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Total Agents', value: isLoading ? '…' : totalAgents, color: 'bg-godavari-500' },
          { icon: CheckCircle, label: 'Active Agents', value: isLoading ? '…' : activeAgents, color: 'bg-green-500' },
          { icon: Ticket, label: 'Total Bookings', value: isLoading ? '…' : totalBookings, color: 'bg-blue-500' },
          { icon: TrendingUp, label: 'Total Revenue', value: isLoading ? '…' : `₹${totalRevenue.toLocaleString('en-IN')}`, color: 'bg-purple-500' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card border rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-xl">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Agents table ────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm">All Agents</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading agents…</div>
        ) : agents.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No agents yet.</p>
            {isSuperAdmin && (
              <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-godavari-600 hover:underline">
                Create the first agent
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Email (Login ID)</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Mobile</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Bookings</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Revenue</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Last Login</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Joined</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {agents.map((agent) => (
                  <>
                    <tr key={agent.id} className="hover:bg-muted/20 transition-colors">
                      {/* Name */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-godavari-100 dark:bg-godavari-900 flex items-center justify-center text-godavari-700 dark:text-godavari-300 font-bold text-xs shrink-0">
                            {agent.name[0].toUpperCase()}
                          </div>
                          <span className="font-medium">{agent.name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{agent.email}</span>
                          <button onClick={() => copyToClipboard(agent.email, 'Email')}
                            className="text-muted-foreground hover:text-foreground transition-colors">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Mobile */}
                      <td className="px-5 py-3">
                        {agent.phone ? (
                          <div className="flex items-center gap-1.5">
                            <span>{agent.phone}</span>
                            <button onClick={() => copyToClipboard(agent.phone!, 'Phone')}
                              className="text-muted-foreground hover:text-foreground transition-colors">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not set</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${agent.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {agent.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Bookings */}
                      <td className="px-5 py-3 text-right font-semibold">{agent.totalBookings}</td>

                      {/* Revenue */}
                      <td className="px-5 py-3 text-right font-semibold">
                        ₹{Number(agent.totalRevenue).toLocaleString('en-IN')}
                      </td>

                      {/* Last login */}
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {agent.lastLogin ? format(new Date(agent.lastLogin), 'dd MMM yyyy, HH:mm') : 'Never'}
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {format(new Date(agent.createdAt), 'dd MMM yyyy')}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setViewCredentials(agent)} title="View credentials"
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {isSuperAdmin && (
                            <>
                              <button onClick={() => openEdit(agent)} title="Edit agent"
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => toggleMutation.mutate({ id: agent.id, isActive: !agent.isActive })}
                                title={agent.isActive ? 'Deactivate' : 'Activate'}
                                className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${agent.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}>
                                <Power className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                            title="View bookings"
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                            {expandedAgent === agent.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded bookings */}
                    {expandedAgent === agent.id && (
                      <tr key={`${agent.id}-exp`}>
                        <td colSpan={9} className="bg-muted/20 px-5 pb-5 pt-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                            Bookings by {agent.name}
                          </p>
                          {loadingBookings ? (
                            <p className="text-sm text-muted-foreground py-4">Loading…</p>
                          ) : !expandedData?.data?.length ? (
                            <p className="text-sm text-muted-foreground py-4">No bookings by this agent yet.</p>
                          ) : (
                            <div className="rounded-xl border overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-background">
                                  <tr>
                                    {['Booking #', 'Passenger', 'Package', 'Travel Date', 'Persons', 'Amount', 'Payment', 'Status', 'Booked On'].map(h => (
                                      <th key={h} className="text-left px-4 py-2 font-medium text-muted-foreground">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {expandedData.data.map((b: AgentBooking) => (
                                    <tr key={b.id} className="hover:bg-muted/30">
                                      <td className="px-4 py-2 font-mono">{b.bookingNumber}</td>
                                      <td className="px-4 py-2">
                                        <p>{b.user?.name}</p>
                                        <p className="text-muted-foreground">{b.user?.email}</p>
                                      </td>
                                      <td className="px-4 py-2">{b.package?.name}</td>
                                      <td className="px-4 py-2">{format(new Date(b.travelDate), 'dd MMM yyyy')}</td>
                                      <td className="px-4 py-2 text-center">{b.numberOfPersons}</td>
                                      <td className="px-4 py-2 font-semibold">₹{Number(b.finalAmount).toLocaleString('en-IN')}</td>
                                      <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 rounded-full font-medium ${b.paymentMode === 'CASH' ? 'bg-orange-100 text-orange-700' : 'bg-sky-100 text-sky-700'}`}>
                                          {b.paymentMode ?? 'CASH'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.status] ?? 'bg-muted'}`}>
                                          {b.status}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-muted-foreground">{format(new Date(b.createdAt), 'dd MMM yyyy, HH:mm')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── View Credentials Modal ───────────────────────────────────────── */}
      {viewCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Agent Credentials</h2>
              <button onClick={() => setViewCredentials(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-godavari-100 dark:bg-godavari-900 flex items-center justify-center text-godavari-700 dark:text-godavari-300 font-bold text-lg">
                {viewCredentials.name[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{viewCredentials.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${viewCredentials.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {viewCredentials.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="space-y-3 bg-muted/40 rounded-xl p-4">
              <CredField label="Login Email" value={viewCredentials.email} />
              <CredField label="Mobile" value={viewCredentials.phone ?? 'Not set'} />
              <CredField label="Password" value="••••••••" note="Use Edit to reset password" />
              <div className="pt-1 border-t flex justify-between text-xs text-muted-foreground">
                <span>Joined: {format(new Date(viewCredentials.createdAt), 'dd MMM yyyy')}</span>
                <span>Last login: {viewCredentials.lastLogin ? format(new Date(viewCredentials.lastLogin), 'dd MMM yyyy') : 'Never'}</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
              Passwords are hashed and cannot be retrieved. Use the <strong>Edit</strong> button to set a new password for this agent.
            </div>

            {isSuperAdmin && (
              <button
                onClick={() => { setViewCredentials(null); openEdit(viewCredentials); }}
                className="w-full py-2 bg-godavari-600 text-white rounded-xl text-sm font-medium hover:bg-godavari-700 transition-colors"
              >
                Reset Password / Edit Agent
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Create Agent Modal ───────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Create Agent</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={createForm.handleSubmit(d => createMutation.mutate(d))} className="space-y-3">
              <FormField label="Full Name *" error={createForm.formState.errors.name?.message}>
                <input {...createForm.register('name')} placeholder="e.g. Ravi Kumar"
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-background" />
              </FormField>
              <FormField label="Email (Login ID) *" error={createForm.formState.errors.email?.message}>
                <input type="email" {...createForm.register('email')} placeholder="agent@example.com"
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-background" />
              </FormField>
              <FormField label="Mobile Number" error={createForm.formState.errors.phone?.message}>
                <input {...createForm.register('phone')} placeholder="9876543210"
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-background" />
              </FormField>
              <PasswordField label="Password *" register={createForm.register('password')} error={createForm.formState.errors.password?.message} />

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 border rounded-xl py-2 text-sm font-medium hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending}
                  className="flex-1 bg-godavari-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-godavari-700 disabled:opacity-60 transition-colors">
                  {createMutation.isPending ? 'Creating…' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Agent Modal ─────────────────────────────────────────────── */}
      {editAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Edit Agent</h2>
              <button onClick={() => setEditAgent(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-muted/40 rounded-xl px-4 py-3 text-sm">
              <span className="text-muted-foreground">Login Email: </span>
              <span className="font-medium">{editAgent.email}</span>
            </div>

            <form onSubmit={editForm.handleSubmit(d => updateMutation.mutate({ id: editAgent.id, data: d }))} className="space-y-3">
              <FormField label="Full Name" error={editForm.formState.errors.name?.message}>
                <input {...editForm.register('name')} placeholder="Full name"
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-background" />
              </FormField>
              <FormField label="Mobile Number" error={editForm.formState.errors.phone?.message}>
                <input {...editForm.register('phone')} placeholder="9876543210"
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-background" />
              </FormField>
              <PasswordField
                label="New Password (leave blank to keep current)"
                register={editForm.register('password')}
                error={editForm.formState.errors.password?.message}
                placeholder="Leave blank to keep unchanged"
              />

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditAgent(null)}
                  className="flex-1 border rounded-xl py-2 text-sm font-medium hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={updateMutation.isPending}
                  className="flex-1 bg-godavari-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-godavari-700 disabled:opacity-60 transition-colors">
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
    </div>
  );
}

function PasswordField({ label, register, error, placeholder = 'Min. 6 characters' }: {
  label: string; register: any; error?: string; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="relative mt-1">
        <input type={show ? 'text' : 'password'} {...register} placeholder={placeholder}
          className="w-full border rounded-xl px-3 py-2 pr-10 text-sm bg-background" />
        <button type="button" onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
    </div>
  );
}

function CredField({ label, value, secret = false, note }: { label: string; value: string; secret?: boolean; note?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium truncate">{secret && !show ? '••••••••' : value}</span>
        {secret && (
          <button onClick={() => setShow(s => !s)} className="text-muted-foreground hover:text-foreground shrink-0">
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
        {value !== 'Not set' && value !== '••••••••' && (
          <button onClick={() => copyToClipboard(value, label)} className="text-muted-foreground hover:text-foreground shrink-0">
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
        {note && <span className="text-xs text-muted-foreground italic">({note})</span>}
      </div>
    </div>
  );
}
