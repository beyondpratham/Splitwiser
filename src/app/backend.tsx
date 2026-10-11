import { BackendForm } from '@/components/BackendForm';
import { Page } from '@/components/Page';

/** Switch to a different Supabase project from Account settings (signs out; the auth gate takes over). */
export default function Backend() {
  return (
    <Page title="Backend" variant="dialog" form>
      <BackendForm />
    </Page>
  );
}
