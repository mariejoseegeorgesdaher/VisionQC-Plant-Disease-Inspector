import { useEffect } from 'react';
import { router } from 'expo-router';

export default function HistoryRedirectScreen() {
  useEffect(() => {
    router.replace('/user/history');
  }, []);

  return null;
}
