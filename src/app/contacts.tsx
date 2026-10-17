import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import { useMemo, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Avatar } from '@/components/Avatar';
import { Button, Field, haptic } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { EmptyState } from '@/components/ui';
import { findUsersByContacts, useAddFriend, useAddFriendByPhone, useFriends, type ContactMatch } from '@/lib/api';
import { normalizePhone } from '@/lib/phone';
import { APP_LINK } from '@/lib/support';
import { space, useTheme } from '@/theme';

interface PhoneContact {
  name: string;
  emails: string[];
  phones: string[];
}

export default function Contacts() {
  const t = useTheme();
  const { friends } = useFriends();
  const addByEmail = useAddFriend();
  const addByPhone = useAddFriendByPhone();
  const { toast, fail } = useFeedback();
  const [state, setState] = useState<'idle' | 'loading' | 'denied' | 'done'>('idle');
  const [contacts, setContacts] = useState<PhoneContact[]>([]);
  const [matches, setMatches] = useState<ContactMatch[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  async function sync() {
    setState('loading');
    try {
      const perm = await requestPermissionsAsync();
      if (!perm.granted) return setState('denied');
      const all = await Contact.getAllDetails([ContactField.FULL_NAME, ContactField.EMAILS, ContactField.PHONES]);
      const list: PhoneContact[] = all
        .map((c) => ({
          name: c.fullName ?? '',
          emails: (c.emails ?? []).map((e) => e.address?.trim().toLowerCase()).filter((e): e is string => !!e),
          phones: (c.phones ?? []).map((p) => normalizePhone(p.number ?? '')).filter((p): p is string => !!p),
        }))
        .filter((c) => c.name && (c.emails.length || c.phones.length));
      setContacts(list);
      setMatches(await findUsersByContacts([...new Set(list.flatMap((c) => c.emails))], [...new Set(list.flatMap((c) => c.phones))]));
      setState('done');
    } catch (e) {
      fail(e);
      setState('idle');
    }
  }

  const matchedKeys = new Set(matches.flatMap((m) => [m.email?.toLowerCase(), m.phone].filter(Boolean) as string[]));
  const q = query.trim().toLowerCase();
  const others = contacts
    .filter((c) => !c.emails.some((e) => matchedKeys.has(e)) && !c.phones.some((p) => matchedKeys.has(p)))
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .slice(0, 200);

  const addMatch = async (m: ContactMatch) => {
    try {
      if (m.email) await addByEmail.mutateAsync({ email: m.email });
      else if (m.phone) await addByPhone.mutateAsync(m.phone);
      setAdded(new Set(added).add(m.id));
      haptic.success();
      toast(`${m.name} added`);
    } catch (e) {
      fail(e);
    }
  };

  const invite = async (c: PhoneContact) => {
    try {
      await Share.share({ message: `Hi ${c.name.split(' ')[0]}! I use SplitWiser to split bills — free, no ads. Join me: ${APP_LINK}` });
    } catch {
      toast('Sharing isn’t available here.');
    }
  };

  if (Platform.OS === 'web') {
    return (
      <Page title="Sync contacts" back variant="large">
        <EmptyState icon="cellphone" title="Use your phone for this" message="Browsers can’t read your contacts. Open SplitWiser on your phone to find friends from your contacts." />
      </Page>
    );
  }

  return (
    <Page title="Sync contacts" back variant="large">
      {state !== 'done' ? (
        <View style={styles.section}>
          <Glass variant="pane" contentStyle={styles.intro}>
            <Glass tint={t.accentSoft} contentStyle={styles.introIcon}>
              <Icon name="contacts-outline" size={34} color={t.accentText} />
            </Glass>
            <T variant="heading" style={{ textAlign: 'center' }}>
              Find friends from your contacts
            </T>
            <T variant="body" tone="dim" style={{ textAlign: 'center' }}>
              SplitWiser checks which of your contacts’ emails and numbers are already on SplitWiser. Only matches are shown, and your contacts are never stored.
            </T>
            {state === 'denied' && (
              <T variant="caption" tone="danger" style={{ textAlign: 'center' }}>
                Contact access was denied. Allow it for SplitWiser in your phone’s settings.
              </T>
            )}
            <Button title="Sync contacts" icon="sync" size="lg" loading={state === 'loading'} onPress={sync} style={{ alignSelf: 'stretch' }} />
          </Glass>
        </View>
      ) : (
        <Animated.View entering={FadeIn}>
          <ListGroup title={`On SplitWiser · ${matches.length}`} footer={matches.length ? undefined : 'None of your contacts are on SplitWiser yet — invite them below.'}>
            {matches.map((m) => {
              const isFriend = friendIds.has(m.id) || added.has(m.id);
              return (
                <ListItem
                  key={m.id}
                  left={<Avatar name={m.name} color={m.avatar_color} avatar={m.avatar} />}
                  title={m.name}
                  subtitle={m.email ?? m.phone ?? undefined}
                  right={isFriend ? <T variant="caption" tone="accent">Friends</T> : <Button title="Add" size="sm" onPress={() => addMatch(m)} />}
                />
              );
            })}
          </ListGroup>

          <View style={[styles.section, { marginBottom: space.md }]}>
            <Field icon="magnify" placeholder="Search contacts" value={query} onChangeText={setQuery} />
          </View>
          <ListGroup title="Invite to SplitWiser" footer="Adding someone by email lets you split with them now; they’ll see everything once they join.">
            {others.map((c, i) => (
              <ListItem
                key={`${c.name}-${i}`}
                left={<Avatar name={c.name} color="#9DB7AA" />}
                title={c.name}
                subtitle={c.emails[0] ?? c.phones[0]}
                right={
                  c.emails[0] ? (
                    <Button
                      title="Add"
                      size="sm"
                      variant="glass"
                      onPress={() =>
                        addByEmail
                          .mutateAsync({ email: c.emails[0], name: c.name })
                          .then(() => toast(`${c.name} added`))
                          .catch(fail)
                      }
                    />
                  ) : (
                    <Button title="Invite" size="sm" variant="glass" onPress={() => invite(c)} />
                  )
                }
              />
            ))}
          </ListGroup>
        </Animated.View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: space.lg, marginBottom: space.xl },
  intro: { alignItems: 'center', gap: space.md, padding: space.xl },
  introIcon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
});
