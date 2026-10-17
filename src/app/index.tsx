import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

/** Entry route: setup, sign in, or straight to Friends (the app's home, like Splitwise). */
export default function Index() {
  const { configured, session } = useAuth();
  if (!configured) return <Redirect href="/setup" />;
  if (!session) return <Redirect href="/sign-in" />;
  return <Redirect href="/friends" />;
}
