import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MeResponse } from '@/lib/user';

type LoadState = 'loading' | 'ready' | 'error';

type DashboardCard = {
  title: string;
  description: string;
  onPress: () => void;
};

type DashboardShellProps = {
  title: string;
  state: LoadState;
  user: MeResponse | null;
  error: string;
  loadingText: string;
  retryText?: string;
  onRetry: () => void;
  onLogout: () => void;
  cards: DashboardCard[];
  initialsFallback: string;
};

export function DashboardShell({
  title,
  state,
  user,
  error,
  loadingText,
  retryText = 'Tap to retry',
  onRetry,
  onLogout,
  cards,
  initialsFallback,
}: DashboardShellProps) {
  const initials = useMemo(() => {
    const name = user?.fullName?.trim();
    if (!name) return initialsFallback;
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }, [initialsFallback, user?.fullName]);

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>{title}</Text>
          {state === 'ready' && user ? (
            <>
              <Text style={styles.subtitle}>{user.fullName}</Text>
              <Text style={styles.meta}>{user.email}</Text>
              {user.role?.trim().toLowerCase() !== 'regular' ? (<Text style={styles.meta}>Role: {user.role}</Text>) : null}
            </>
          ) : state === 'loading' ? (
            <Text style={styles.subtitle}>{loadingText}</Text>
          ) : (
            <>
              <Text style={styles.error}>{error}</Text>
              <Pressable onPress={onRetry}>
                <Text style={styles.retry}>{retryText}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      <View style={styles.grid}>
        {cards.map((card) => (
          <Pressable key={card.title} style={styles.card} onPress={card.onPress}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardText}>{card.description}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f5f1',
    padding: 20,
    gap: 14,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0d4d3d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  headerTextBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0d4d3d',
  },
  subtitle: {
    fontSize: 15,
    color: '#2a2d35',
    opacity: 0.9,
  },
  meta: {
    fontSize: 13,
    color: '#2a2d35',
    opacity: 0.7,
  },
  error: {
    fontSize: 13,
    color: '#dc2626',
  },
  retry: {
    color: '#0d4d3d',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  grid: {
    gap: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 14,
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    color: '#0d4d3d',
    fontWeight: '700',
  },
  cardText: {
    fontSize: 13,
    color: '#2a2d35',
    opacity: 0.75,
  },
  logoutButton: {
    marginTop: 'auto',
    backgroundColor: '#0d4d3d',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});


