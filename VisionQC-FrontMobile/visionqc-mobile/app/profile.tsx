import { useEffect } from 'react';
import { router } from 'expo-router';

export default function ProfileRedirectScreen() {
  useEffect(() => {
    router.replace('/user/profile');
  }, []);

  return null;
}
