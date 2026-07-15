import { Redirect } from 'expo-router';

export default function RemindersRedirectScreen() {
  return <Redirect href={'/user/reminders' as never} />;
}
