import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { getCurrentUser, getRoleHomeRoute } from '@/lib/user';

export default function DashboardRedirectScreen() {
  useEffect(() => {
    const routeByRole = async () => {
      try {
        const me = await getCurrentUser();
        router.replace(getRoleHomeRoute(me.role));
      } catch {
        router.replace('/');
      }
    };

    void routeByRole();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0d4d3d" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f5f1',
  },
});
