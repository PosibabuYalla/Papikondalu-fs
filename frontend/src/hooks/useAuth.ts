'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function useLogin() {
  const { setUser, setTokens } = useAuthStore();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) => api.post('/auth/login', data).then(r => r.data.data),
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      toast.success('Welcome back!');
      if (data.user.role === 'USER') router.push('/dashboard');
      else if (data.user.role === 'AGENT') router.push('/agent/dashboard');
      else router.push('/admin/dashboard');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.message || 'Login failed'),
  });
}

export function useRegister() {
  const { setUser, setTokens } = useAuthStore();
  const router = useRouter();
  return useMutation({
    mutationFn: (data: any) => api.post('/auth/register', data).then(r => r.data.data),
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      toast.success('Account created successfully!');
      router.push('/dashboard');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Registration failed'),
  });
}

export function useLogout() {
  const { logout, refreshToken } = useAuthStore();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api.post('/auth/logout', { refreshToken }),
    onSettled: () => {
      logout();
      router.push('/');
      toast.success('Logged out');
    },
  });
}

export function useProfile() {
  const { isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/profile').then(r => r.data.data),
    enabled: isAuthenticated,
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.post('/auth/forgot-password', { email }).then(r => r.data),
    onError: () => toast.error('Something went wrong. Please try again.'),
  });
}

export function useResetPassword() {
  const router = useRouter();
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      api.post('/auth/reset-password', { token, newPassword }).then(r => r.data),
    onSuccess: () => {
      toast.success('Password reset successfully!');
      router.push('/login');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Reset failed. Link may have expired.'),
  });
}
