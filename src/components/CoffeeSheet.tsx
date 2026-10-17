import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { COFFEE_AMOUNT_INR, UPI_ID, upiLink } from '@/lib/support';
import { space, useTheme } from '@/theme';
import { Button, haptic } from './Controls';
import { useFeedback } from './Feedback';
import { Sheet } from './Sheet';
import { T } from './Text';

/** Buy me a coffee: a pop-up that hands ₹10 straight to a UPI app (GPay, PhonePe, Paytm…). */
export function CoffeeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { toast } = useFeedback();
  const link = upiLink();

  const pay = async () => {
    if (!link) return;
    if (Platform.OS === 'web') {
      toast('Open SplitWiser on your phone to pay with a UPI app.');
      return;
    }
    try {
      await Linking.openURL(link);
      onClose();
    } catch {
      toast('No UPI app found. Copy the UPI ID and pay from any app instead.');
    }
  };

  const copy = async () => {
    await Clipboard.setStringAsync(UPI_ID);
    haptic.success();
    toast('UPI ID copied');
  };

  return (
    <Sheet visible={visible} onClose={onClose} scroll={false}>
      <View style={styles.body}>
        <View style={[styles.cup, { backgroundColor: t.accentSoft }]}>
          <Image source={require('../../assets/images/coffee-cup.png')} style={{ width: 62, height: 62 }} contentFit="contain" />
        </View>
        <T variant="title" style={{ textAlign: 'center' }}>
          Buy me a coffee
        </T>
        <T variant="body" tone="dim" style={{ textAlign: 'center' }}>
          SplitWiser is free, with no ads and no limits. If it saved you an awkward money talk, a ₹{COFFEE_AMOUNT_INR} coffee keeps it that way.
        </T>
        <T variant="display" numeric style={{ color: t.accentText }}>
          ₹{COFFEE_AMOUNT_INR}
        </T>
        <Button title={`Pay ₹${COFFEE_AMOUNT_INR} with UPI`} icon="cellphone-arrow-down" size="lg" disabled={!link} onPress={pay} style={{ alignSelf: 'stretch' }} />
        <Button title="Copy UPI ID" icon="content-copy" variant="glass" onPress={copy} style={{ alignSelf: 'stretch' }} />
        <T variant="caption" tone="dim" selectable>
          {UPI_ID}
        </T>
        <T variant="caption" tone="faint" style={{ textAlign: 'center' }}>
          Completely optional — every feature stays free either way. Thank you! 💚
        </T>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, paddingBottom: space.lg },
  cup: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
});
