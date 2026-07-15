import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';

import { DashboardShell } from '@/components/screens/dashboard-shell';
import { clearAuthToken } from '@/lib/auth';
import { MeResponse, getCurrentUser, isAdminRole } from '@/lib/user';
import { getCachedCurrentUser } from '@/lib/current-user-cache';

type LoadState = 'loading' | 'ready' | 'error';

function buildGreeting(fullName?: string | null): string {
  const name = fullName?.trim();
  if (!name) return 'Hello';
  const firstName = name.split(/\s+/)[0];
  return `Hello, ${firstName}`;
}

export default function UserDashboardScreen() {
  // User dashboard is the normal-user landing page after login.
  const cachedUser = getCachedCurrentUser();
  const [state, setState] = useState<LoadState>(cachedUser ? 'ready' : 'loading');
  const [user, setUser] = useState<MeResponse | null>(cachedUser);
  const [error, setError] = useState('');

  const loadMe = useCallback(async () => {
    try {
      setState((prev) => (user ? prev : 'loading'));
      setError('');
      const me = await getCurrentUser();
      // If an admin reaches this screen directly, send them back to the admin area.
      if (isAdminRole(me.role)) {
        router.replace('/admin/dashboard');
        return;
      }
      setUser(me);
      setState('ready');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to load profile');
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
      // These cards are the user's main navigation menu.
      {
        title: 'Scan Plant',
        description: 'Capture and analyze a plant image.',
        onPress: () => router.push('/user/scan'),
      },
      {
        title: 'My History',
        description: 'View your previous scans and outcomes.',
        onPress: () => router.push('/user/history'),
      },
      {
        title: 'Reminders',
        description: 'Track scheduled follow-up re-scans.',
        onPress: () => router.push('/user/reminders' as never),
      },
      {
        title: 'My Plants',
        description: 'Browse saved plant aliases and open their details.',
        onPress: () => router.push('/user/plants'),
      },
      {
        title: 'My Profile',
        description: 'Update your account details and password.',
        onPress: () => router.push('/user/profile'),
      },
    ],
    []
  );

  return (
    <DashboardShell
      title={buildGreeting(user?.fullName)}
      state={state}
      user={user}
      error={error}
      loadingText="Loading profile..."
      onRetry={loadMe}
      onLogout={handleLogout}
      cards={cards}
      initialsFallback="U"
    />
  );
}
