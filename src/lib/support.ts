// Personal details for the Account screen. Fill these in when ready — the app shows sensible
// placeholders until then.
import type { ImageSourcePropType } from 'react-native';

/** Your UPI ID (e.g. "name@okbank"). Enables the "Pay ₹10 with UPI" button on Buy me a coffee. */
export const UPI_ID = '';

/** Name shown in the UPI app when paying. */
export const UPI_NAME = 'Pratham';

/** Coffee amount in rupees. */
export const COFFEE_AMOUNT_INR = 10;

/**
 * Your UPI QR code. Save the image as assets/upi-qr.png and change this to:
 *   export const UPI_QR: ImageSourcePropType | null = require('../../assets/upi-qr.png');
 */
export const UPI_QR: ImageSourcePropType | null = null;

/** Where "Contact support" emails go. Leave empty to hide the email option. */
export const SUPPORT_EMAIL = '';

export const REPO_URL = 'https://github.com/beyondpratham/Splitwiser';
export const ISSUES_URL = `${REPO_URL}/issues`;

export function upiLink(amount = COFFEE_AMOUNT_INR) {
  if (!UPI_ID) return null;
  const params = new URLSearchParams({ pa: UPI_ID, pn: UPI_NAME, am: String(amount), cu: 'INR', tn: 'Coffee for SplitWiser' });
  return `upi://pay?${params.toString()}`;
}

/** Link shared by "Share SplitWiser". Switch to the Play Store listing once the app is published. */
export const APP_LINK = REPO_URL;
