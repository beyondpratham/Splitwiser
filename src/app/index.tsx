import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

/** Entry route: send people to setup, sign in or their groups. */
export default function Index() {
  const { configured, session } = useAuth();
  if (!configured) return <Redirect href="/setup" />;
  if (!session) return <Redirect href="/sign-in" />;
  return <Redirect href="/groups" />;
}
