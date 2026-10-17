// Personal details used on the Account screen (Buy me a coffee, Help & support).

/** Your UPI ID. Buy me a coffee opens a UPI app with this filled in. */
export const UPI_ID = 'prathamrd28-2@okicici';

/** Name shown in the UPI app when paying. */
export const UPI_NAME = 'Pratham';

/** Coffee amount in rupees. */
export const COFFEE_AMOUNT_INR = 10;

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
