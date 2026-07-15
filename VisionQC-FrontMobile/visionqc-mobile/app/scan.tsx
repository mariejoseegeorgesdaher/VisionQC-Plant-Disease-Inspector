import { useEffect } from 'react';
import { router } from 'expo-router';

export default function ScanRedirectScreen() {
  useEffect(() => {
    router.replace('/user/scan');
  }, []);

  return null;
}
