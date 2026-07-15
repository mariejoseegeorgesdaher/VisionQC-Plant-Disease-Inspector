import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';

import { DashboardShell } from '@/components/screens/dashboard-shell';
import { clearAuthToken } from '@/lib/auth';
import { MeResponse, getCurrentUser, isAdminRole } from '@/lib/user';
import { getCachedCurrentUser } from '@/lib/current-user-cache';

type LoadState = 'loading' | 'ready' | 'error';

export default function AdminDashboardScreen() {
  // Admin dashboard is the admin landing page after role-based login routing.
  // This makes the screen feel faster if the profile was already loaded before.
  const cachedUser = getCachedCurrentUser();
  const [state, setState] = useState<LoadState>(cachedUser ? 'ready' : 'loading');
  const [user, setUser] = useState<MeResponse | null>(cachedUser);
  const [error, setError] = useState('');

  const loadMe = useCallback(async () => {
    try {
      setState((prev) => (user ? prev : 'loading'));
      setError('');
      const me = await getCurrentUser();
      // If a normal user reaches this route directly, send them back to user dashboard.
      if (!isAdminRole(me.role)) {
        router.replace('/user/dashboard');
        return;
      }
      setUser(me);
      setState('ready');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to load admin profile');
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadMe();
    }, [loadMe])
  );

  const handleLogout = useCallback(async () => {
    await clearAuthToken();
    router.replace('/');
  }, []);

  const cards = useMemo(
    () => [
      {
        title: 'Change Info',
        description: 'Update your admin profile and password.',
        onPress: () => router.push('/admin/profile'),
      },
      {
        title: 'Manage Users',
        description: 'Review and supervise user accounts.',
        onPress: () => router.push('/admin/users'),
      },
      {
        title: 'Scans Oversight',
        description: 'Review global scan activity and outcomes.',
        onPress: () => router.push('/admin/scans'),
      },
    ],
    []
  );

  return (
    <DashboardShell
      title="Admin Dashboard"
      state={state}
      user={user}
      error={error}
      loadingText="Loading admin profile..."
      onRetry={loadMe}
      onLogout={handleLogout}
      cards={cards}
      initialsFallback="A"
    />
  );
}
