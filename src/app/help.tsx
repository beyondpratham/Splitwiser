import Constants from 'expo-constants';
import { Fragment, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { haptic } from '@/components/Controls';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { Tile } from '@/components/Tile';
import { ISSUES_URL, REPO_URL, SUPPORT_EMAIL } from '@/lib/support';
import { space, useTheme } from '@/theme';

const FAQ = [
  {
    q: 'How do I split an expense?',
    a: 'Tap Add expense, enter what it was for and the amount, choose a group or friends, then tap “split equally” to switch to exact amounts, percentages or shares. Tap “Paid by” if someone else paid, or if several people paid together.',
  },
  {
    q: 'What does “simplify debts” do?',
    a: 'It combines balances inside a group so the fewest payments settle everyone. Nobody ends up paying more in total — there are just fewer transfers. Turn it on or off in the group’s settings.',
  },
  {
    q: 'Does SplitWiser move money?',
    a: 'No. Settle up only records a payment so balances update. Pay your friend with any app you like (UPI, cash, bank), then record it here.',
  },
  {
    q: 'Can I add friends who aren’t on SplitWiser?',
    a: 'Yes. Add them by email. They’ll see every shared expense as soon as they sign up with that email.',
  },
  {
    q: 'Can I use different currencies?',
    a: 'Yes, each expense has its own currency. Balances are kept per currency and never converted.',
  },
  {
    q: 'I deleted an expense by mistake.',
    a: 'Tap Undo on the message that appears, or open the expense from the Activity tab and tap Restore.',
  },
  {
    q: 'Who can see my data?',
    a: 'Only people you share expenses or groups with. The database enforces this for every request, and there are no ads or trackers.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Account → Settings → Delete account. Your login, friends and comments are removed; shared expenses stay with the others as “Deleted user”.',
  },
];

export default function Help() {
  const t = useTheme();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Page title="Help & support" back variant="large">
      <View style={styles.section}>
        <T variant="overline" tone="dim" style={styles.label}>
          Frequently asked
        </T>
        <Glass variant="pane">
          {FAQ.map((item, i) => (
            <Fragment key={item.q}>
              <Animated.View layout={LinearTransition.springify().damping(18)}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open === i }}
                  onPress={() => {
                    haptic.tap();
                    setOpen(open === i ? null : i);
                  }}
                  style={styles.q}
                >
                  <T variant="bodyStrong" style={{ flex: 1 }}>
                    {item.q}
                  </T>
                  <Icon name={open === i ? 'chevron-up' : 'chevron-down'} size={22} color={t.inkDim} />
                </Pressable>
                {open === i && (
                  <Animated.View entering={FadeIn.duration(220)} style={styles.a}>
                    <T variant="body" tone="dim">
                      {item.a}
                    </T>
                  </Animated.View>
                )}
              </Animated.View>
              {i < FAQ.length - 1 && <View style={[styles.sep, { backgroundColor: t.line }]} />}
            </Fragment>
          ))}
        </Glass>
      </View>

      <ListGroup title="Get in touch">
        {SUPPORT_EMAIL ? (
          <ListItem
            left={<Tile icon="email-outline" />}
            title="Contact support"
            subtitle={SUPPORT_EMAIL}
            chevron
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('SplitWiser support')}`)}
          />
        ) : null}
        <ListItem left={<Tile icon="bug-outline" />} title="Report a problem" subtitle="Opens an issue on GitHub" chevron onPress={() => Linking.openURL(ISSUES_URL)} />
        <ListItem left={<Tile icon="github" />} title="Source code" subtitle="SplitWiser is open source" chevron onPress={() => Linking.openURL(REPO_URL)} />
      </ListGroup>

      <T variant="caption" tone="faint" style={{ textAlign: 'center' }}>
        SplitWiser {Constants.expoConfig?.version ?? ''} · no ads, no limits
      </T>
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: space.lg, marginBottom: space.xl },
  label: { marginBottom: space.sm, marginLeft: space.sm },
  q: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 58, paddingVertical: space.md },
  a: { paddingHorizontal: space.lg, paddingBottom: space.lg, marginTop: -space.xs },
  sep: { height: StyleSheet.hairlineWidth, marginHorizontal: space.lg },
});
