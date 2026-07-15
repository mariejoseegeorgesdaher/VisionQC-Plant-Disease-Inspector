import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Image, StyleSheet, useColorScheme } from 'react-native';
import 'react-native-reanimated';

import { initializeGoogleSignin } from '@/lib/google-signin';

const appLogo = require('@/assets/images/icon.png');

function HeaderLogo() {
  return <Image source={appLogo} style={styles.headerLogo} />;
}

export default function RootLayout() {
  // We let the app follow the device color scheme so navigation theming feels native.
  const colorScheme = useColorScheme();

  useEffect(() => {
    initializeGoogleSignin();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Expo Router uses this stack to declare every screen and its header behavior. */}
      <Stack
        screenOptions={{
          headerRight: HeaderLogo,
        }}>
        {/* Auth and startup screens live at the top-level routes. */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: 'Register' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Forgot Password' }} />
        <Stack.Screen name="reset-password" options={{ title: 'Reset Password' }} />
        <Stack.Screen name="dashboard" options={{ title: 'Vision QC' }} />

        {/* User routes cover the normal plant-care workflow. */}
        <Stack.Screen name="user/dashboard" options={{ title: 'Home' }} />
        <Stack.Screen name="user/scan" options={{ title: 'Scan Plant' }} />
        <Stack.Screen name="user/history" options={{ title: 'My History' }} />
        <Stack.Screen name="user/reminders" options={{ title: 'Reminders' }} />
        <Stack.Screen name="user/plants" options={{ title: 'My Plants' }} />
        <Stack.Screen name="user/profile" options={{ title: 'My Profile' }} />

        {/* Admin routes are separated so role-based navigation can send admins to a different area. */}
        <Stack.Screen name="admin/dashboard" options={{ title: 'Admin Dashboard' }} />
        <Stack.Screen name="admin/users" options={{ title: 'Manage Users' }} />
        <Stack.Screen name="admin/scans" options={{ title: 'Scans Oversight' }} />
      </Stack>
      {/* Status bar styling follows the current theme automatically. */}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  headerLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: 2,
  },
});
