import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  getAdminUsers,
  getDiseasesByLocation,
  getStatsOverview,
  type AdminStatsOverview,
  type AdminUser,
  type DiseaseCount,
  type LocationDiseaseStats,
} from '@/lib/admin';

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function getPercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DistributionRow({
  color,
  label,
  percent,
  value,
}: {
  color: string;
  label: string;
  percent: number;
  value: number;
}) {
  return (
    <View style={styles.distributionRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.distributionText}>
        <Text style={styles.value}>{label}</Text>
        <Text style={styles.muted}>{percent}%</Text>
      </View>
      <Text style={styles.value}>{formatNumber(value)}</Text>
    </View>
  );
}

function BarRow({
  label,
  meta,
  value,
  maxValue,
}: {
  label: string;
  meta?: string;
  value: number;
  maxValue: number;
}) {
  // Simple proportional bar used instead of a chart library for lightweight mobile stats.
  const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 6) : 0;

  return (
    <View style={styles.barBlock}>
      <View style={styles.barHeader}>
        <View style={styles.barLabelBlock}>
          <Text style={styles.value}>{label}</Text>
          {meta ? <Text style={styles.muted}>{meta}</Text> : null}
        </View>
        <Text style={styles.value}>{formatNumber(value)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${width}%` }]} />
      </View>
    </View>
  );
}

export default function AdminScansScreen() {
  // Read-only admin analytics screen for global scan/user statistics.
  const [overview, setOverview] = useState<AdminStatsOverview | null>(null);
  const [locations, setLocations] = useState<LocationDiseaseStats[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [top, setTop] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Load all admin stats together so the screen updates in one pass.
      const [ov, loc, userPage] = await Promise.all([
        getStatsOverview(top),
        getDiseasesByLocation(),
        getAdminUsers({ page: 1, pageSize: 1000 }),
      ]);
      setOverview(ov);
      setLocations(loc);
      setUsers(userPage.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [top]);

  useFocusEffect(
    useCallback(() => {
    void loadStats();
    }, [loadStats])
  );

  const dashboardStats = useMemo(() => {
    // Prefer stats endpoint values, but fall back to user list data if a metric is missing.
    const totalUsers = overview?.totalUsers ?? users.length;
    const totalScans = overview?.totalScans ?? users.reduce((sum, user) => sum + (Number(user.scanCount) || 0), 0);
    const activeUsers = overview?.activeUsers ?? users.filter((user) => user.isActive).length;
    const inactiveUsers = Math.max(totalUsers - activeUsers, 0);
    const adminUsers = users.filter((user) => String(user.role || '').toLowerCase() === 'admin').length;
    const regularUsers = Math.max(users.length - adminUsers, 0);
    const averageScansPerUser = totalUsers > 0 ? totalScans / totalUsers : 0;

    return {
      activeUsers,
      adminUsers,
      averageScansPerUser,
      inactiveUsers,
      regularUsers,
      totalScans,
      totalUsers,
    };
  }, [overview, users]);

  const topDiseases = useMemo(() => overview?.topDiseases ?? [], [overview]);

  const diseaseByLocationData = useMemo(() => {
    // Convert nested location disease data into the top disease per location for compact display.
    return locations
      .map((item) => {
        const topDisease = Array.isArray(item.diseases) && item.diseases.length > 0 ? item.diseases[0] : null;

        return {
          location: item.location,
          topDisease: topDisease?.disease || 'Unknown disease',
          diseasedScans: topDisease?.count || 0,
        };
      })
      .filter((item) => item.diseasedScans > 0)
      .sort((left, right) => right.diseasedScans - left.diseasedScans)
      .slice(0, 6);
  }, [locations]);

  const topDiseaseMax = topDiseases.reduce((max, item) => Math.max(max, Number(item.count) || 0), 0);
  const locationMax = diseaseByLocationData.reduce((max, item) => Math.max(max, Number(item.diseasedScans) || 0), 0);
  const totalStatusUsers = dashboardStats.activeUsers + dashboardStats.inactiveUsers;
  const totalRoleUsers = dashboardStats.adminUsers + dashboardStats.regularUsers;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Scans Oversight</Text>
      <Text style={styles.subtitle}>
        {loading
          ? 'Loading live admin metrics...'
          : `${formatNumber(dashboardStats.totalUsers)} users, ${formatNumber(dashboardStats.totalScans)} scans, ${formatNumber(overview?.scansLast7Days ?? 0)} scans in the last 7 days.`}
      </Text>

      <View style={styles.row}>
        <Pressable style={[styles.secondaryButton, top === 5 && styles.secondaryButtonActive]} onPress={() => setTop(5)}>
          <Text style={[styles.secondaryButtonText, top === 5 && styles.secondaryButtonTextActive]}>Top 5</Text>
        </Pressable>
        <Pressable style={[styles.secondaryButton, top === 10 && styles.secondaryButtonActive]} onPress={() => setTop(10)}>
          <Text style={[styles.secondaryButtonText, top === 10 && styles.secondaryButtonTextActive]}>Top 10</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={loadStats}>
          <Text style={styles.primaryButtonText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color="#0d4d3d" /> : null}
      {!!error ? <Text style={styles.error}>{error}</Text> : null}

      {overview ? (
        <View style={styles.statsGrid}>
          <StatCard label="Total Users" value={formatNumber(dashboardStats.totalUsers)} />
          <StatCard label="Total Scans" value={formatNumber(dashboardStats.totalScans)} />
          <StatCard label="Active Users" value={formatNumber(dashboardStats.activeUsers)} />
          <StatCard label="Avg. Scans / User" value={dashboardStats.averageScansPerUser.toFixed(1)} />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Role Overview</Text>
        {totalRoleUsers === 0 ? <Text style={styles.value}>No role data available yet.</Text> : null}
        {totalRoleUsers > 0 ? (
          <>
            <DistributionRow
              color="#0d4d3d"
              label="Admins"
              percent={getPercent(dashboardStats.adminUsers, totalRoleUsers)}
              value={dashboardStats.adminUsers}
            />
            <DistributionRow
              color="#9ae66e"
              label="Regular Users"
              percent={getPercent(dashboardStats.regularUsers, totalRoleUsers)}
              value={dashboardStats.regularUsers}
            />
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>User Status Distribution</Text>
        {totalStatusUsers === 0 ? <Text style={styles.value}>No user status data available yet.</Text> : null}
        {totalStatusUsers > 0 ? (
          <>
            <DistributionRow
              color="#6effc9"
              label="Active"
              percent={getPercent(dashboardStats.activeUsers, totalStatusUsers)}
              value={dashboardStats.activeUsers}
            />
            <DistributionRow
              color="#2a2d35"
              label="Inactive"
              percent={getPercent(dashboardStats.inactiveUsers, totalStatusUsers)}
              value={dashboardStats.inactiveUsers}
            />
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Top Diseases</Text>
        {!topDiseases.length ? <Text style={styles.value}>No disease statistics available yet.</Text> : null}
        {topDiseases.map((d: DiseaseCount) => (
          <BarRow key={d.disease} label={d.disease} value={d.count} maxValue={topDiseaseMax} />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Disease by Location</Text>
        {!diseaseByLocationData.length ? <Text style={styles.value}>No diseased scan locations available yet.</Text> : null}
        {diseaseByLocationData.map((loc) => (
          <BarRow
            key={loc.location}
            label={loc.location}
            meta={loc.topDisease}
            value={loc.diseasedScans}
            maxValue={locationMax}
          />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Location Details</Text>
        {!locations.length ? <Text style={styles.value}>No location stats yet.</Text> : null}
        {locations.map((loc) => (
          <View key={loc.location} style={styles.locationBlock}>
            <Text style={styles.locationTitle}>{loc.location}</Text>
            {loc.diseases.slice(0, 3).map((d) => (
              <Text key={`${loc.location}-${d.disease}`} style={styles.value}>{d.disease}: {d.count}</Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f6f5f1',
    gap: 10,
  },
  title: {
    fontSize: 24,
    color: '#0d4d3d',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: '#2a2d35',
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#0d4d3d',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#e7efec',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonActive: {
    backgroundColor: '#0d4d3d',
  },
  secondaryButtonText: {
    color: '#0d4d3d',
    fontWeight: '700',
  },
  secondaryButtonTextActive: {
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    minHeight: 92,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 12,
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 24,
    color: '#0d4d3d',
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    color: '#2a2d35',
    opacity: 0.65,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 12,
    gap: 5,
  },
  sectionTitle: {
    fontSize: 17,
    color: '#0d4d3d',
    fontWeight: '700',
  },
  value: {
    fontSize: 13,
    color: '#2a2d35',
  },
  muted: {
    fontSize: 12,
    color: '#2a2d35',
    opacity: 0.6,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  distributionText: {
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  barBlock: {
    gap: 6,
  },
  barHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  barLabelBlock: {
    flex: 1,
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(13, 77, 61, 0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0d4d3d',
  },
  locationBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  locationTitle: {
    fontSize: 13,
    color: '#0d4d3d',
    fontWeight: '700',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
  },
});
