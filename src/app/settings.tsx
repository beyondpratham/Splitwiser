import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Segmented } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Glass } from '@/components/Glass';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { Tile } from '@/components/Tile';
import { useDeleteAccount } from '@/lib/api';
import { space, useThemeMode, type ThemeMode } from '@/theme';

export default function Settings() {
  const { mode, setMode } = useThemeMode();
  const deleteAccount = useDeleteAccount();
  const { confirm, fail } = useFeedback();

  return (
    <Page title="Settings" back variant="large">
      <View style={styles.section}>
        <T variant="overline" tone="dim" style={styles.label}>
          Appearance
        </T>
        <Glass variant="pane" contentStyle={{ padding: space.lg, gap: space.md }}>
          <Segmented<ThemeMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
              { value: 'dark', label: 'Dark', icon: 'weather-night' },
              { value: 'system', label: 'System', icon: 'cellphone' },
            ]}
          />
          <T variant="caption" tone="dim">
            System follows your phone’s light or dark mode.
          </T>
        </Glass>
      </View>

      <ListGroup title="Data">
        <ListItem left={<Tile icon="chart-donut" />} title="Spending insights" subtitle="Where your money goes, by month and category" chevron onPress={() => router.push('/insights')} />
        <ListItem left={<Tile icon="database-cog-outline" />} title="Server" subtitle="Change the Supabase project this app uses" chevron onPress={() => router.push('/backend')} />
      </ListGroup>

      <ListGroup title="Account" footer="Deleting removes your login, friend list and comments for good. Expenses you shared stay visible to the others, shown as “Deleted user”.">
        <ListItem
          left={<Tile icon="account-remove-outline" danger />}
          title="Delete account"
          tone="danger"
          onPress={async () => {
            const sure = await confirm({
              title: 'Delete your account?',
              message: 'Your login, friend list and comments are removed for good. Shared expenses stay with the others as “Deleted user”.',
              confirmLabel: 'Delete account',
              destructive: true,
            });
            if (sure) deleteAccount.mutateAsync().catch(fail);
          }}
        />
      </ListGroup>
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: space.lg, marginBottom: space.xl },
  label: { marginBottom: space.sm, marginLeft: space.sm },
});
