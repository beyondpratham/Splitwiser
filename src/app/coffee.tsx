import { Image } from 'expo-image';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Button } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { COFFEE_AMOUNT_INR, UPI_ID, UPI_QR, upiLink } from '@/lib/support';
import { space, useTheme, R } from '@/theme';

/** Buy me a coffee: ₹10 over UPI — scan the QR, or open a UPI app directly on a phone. */
export default function Coffee() {
  const t = useTheme();
  const { toast } = useFeedback();
  const link = upiLink();

  return (
    <Page title="Buy me a coffee" variant="dialog">
      <View style={styles.hero}>
        <Animated.View entering={ZoomIn.springify().damping(11)}>
          <Glass variant="pill" tint={t.accentSoft} contentStyle={styles.cup}>
            <T style={{ fontSize: 46 }}>☕</T>
          </Glass>
        </Animated.View>
        <T variant="title" style={{ textAlign: 'center' }}>
          Enjoying SplitWiser?
        </T>
        <T variant="body" tone="dim" style={{ textAlign: 'center' }}>
          It’s free, ad-free and has no limits. If it saved you an awkward money talk, a ₹{COFFEE_AMOUNT_INR} coffee keeps it that way.
        </T>
      </View>

      <Animated.View entering={FadeInDown.delay(120).springify().damping(18)} style={styles.section}>
        <Glass variant="pane" contentStyle={styles.card}>
          <T variant="overline" tone="dim">
            Amount
          </T>
          <T variant="display" numeric style={{ fontSize: 48, lineHeight: 56, color: t.accentText }}>
            ₹{COFFEE_AMOUNT_INR}
          </T>

          {UPI_QR ? (
            <View style={[styles.qr, { backgroundColor: '#FFFFFF' }]}>
              <Image source={UPI_QR} style={{ width: '100%', height: '100%' }} contentFit="contain" accessibilityLabel="UPI QR code" />
            </View>
          ) : (
            <View style={[styles.qr, styles.qrEmpty, { borderColor: t.inkFaint }]}>
              <Icon name="qrcode-scan" size={44} color={t.inkFaint} />
              <T variant="caption" tone="faint" style={{ textAlign: 'center' }}>
                UPI QR code coming soon
              </T>
            </View>
          )}
          <T variant="caption" tone="dim" style={{ textAlign: 'center' }}>
            Scan with any UPI app — GPay, PhonePe, Paytm or your bank’s app.
          </T>

          <Button
            title={`Pay ₹${COFFEE_AMOUNT_INR} with UPI`}
            icon="cellphone-arrow-down"
            size="lg"
            disabled={!link}
            style={{ alignSelf: 'stretch', marginTop: space.sm }}
            onPress={async () => {
              if (!link) return;
              const ok = Platform.OS !== 'web' && (await Linking.canOpenURL(link).catch(() => false));
              if (ok) Linking.openURL(link);
              else toast('Open SplitWiser on your phone to pay with a UPI app, or scan the QR code.');
            }}
          />
          {!UPI_ID && (
            <T variant="caption" tone="faint" style={{ textAlign: 'center' }}>
              UPI payments will be available soon.
            </T>
          )}
        </Glass>
      </Animated.View>

      <T variant="caption" tone="faint" style={{ textAlign: 'center', marginHorizontal: space.xl }}>
        Completely optional — every feature stays free either way. Thank you! 💚
      </T>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, marginBottom: space.xl },
  cup: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  section: { marginHorizontal: space.lg, marginBottom: space.xl },
  card: { alignItems: 'center', gap: space.md, padding: space.xl },
  qr: { width: 200, height: 200, borderRadius: R, overflow: 'hidden', padding: 12 },
  qrEmpty: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
