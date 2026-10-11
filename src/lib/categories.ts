import type { IconName } from '@/components/Icon';

export interface Category {
  id: string;
  label: string;
  group: 'Food' | 'Home' | 'Transport' | 'Life' | 'Other';
  icon: IconName;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: 'general', label: 'General', group: 'Other', icon: 'shape', color: '#8E8E93' },
  { id: 'groceries', label: 'Groceries', group: 'Food', icon: 'cart', color: '#34C759' },
  { id: 'dining', label: 'Dining out', group: 'Food', icon: 'silverware-fork-knife', color: '#FF9500' },
  { id: 'coffee', label: 'Coffee', group: 'Food', icon: 'coffee', color: '#A2845E' },
  { id: 'drinks', label: 'Drinks', group: 'Food', icon: 'glass-cocktail', color: '#AF52DE' },
  { id: 'rent', label: 'Rent', group: 'Home', icon: 'home-city', color: '#5856D6' },
  { id: 'utilities', label: 'Utilities', group: 'Home', icon: 'flash', color: '#FFCC00' },
  { id: 'internet', label: 'Internet & phone', group: 'Home', icon: 'wifi', color: '#32ADE6' },
  { id: 'household', label: 'Household', group: 'Home', icon: 'sofa', color: '#AC8E68' },
  { id: 'transport', label: 'Transport', group: 'Transport', icon: 'train', color: '#007AFF' },
  { id: 'taxi', label: 'Taxi', group: 'Transport', icon: 'taxi', color: '#FFB800' },
  { id: 'fuel', label: 'Fuel', group: 'Transport', icon: 'gas-station', color: '#FF3B30' },
  { id: 'flights', label: 'Flights', group: 'Transport', icon: 'airplane', color: '#5AC8FA' },
  { id: 'lodging', label: 'Hotel', group: 'Life', icon: 'bed', color: '#30B0C7' },
  { id: 'entertainment', label: 'Entertainment', group: 'Life', icon: 'ticket', color: '#FF2D55' },
  { id: 'shopping', label: 'Shopping', group: 'Life', icon: 'shopping', color: '#FF6482' },
  { id: 'health', label: 'Health', group: 'Life', icon: 'medical-bag', color: '#FF453A' },
  { id: 'sports', label: 'Sports', group: 'Life', icon: 'run', color: '#00C7BE' },
  { id: 'gifts', label: 'Gifts', group: 'Life', icon: 'gift', color: '#BF5AF2' },
  { id: 'subscriptions', label: 'Subscriptions', group: 'Life', icon: 'play-box-multiple', color: '#E5484D' },
];

export const PAYMENT_CATEGORY: Category = {
  id: 'payment', label: 'Payment', group: 'Other', icon: 'cash-fast', color: '#34C759',
};

export function categoryById(id: string | null | undefined): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

/** Lightweight keyword guess so the category is usually right without the user touching it. */
const KEYWORDS: [RegExp, string][] = [
  [/grocer|supermarket|walmart|costco|aldi|lidl|tesco|whole ?foods|trader/i, 'groceries'],
  [/coffee|starbucks|cafe|latte/i, 'coffee'],
  [/beer|bar|wine|drinks|pub|cocktail/i, 'drinks'],
  [/dinner|lunch|breakfast|brunch|restaurant|pizza|burger|sushi|food|meal|takeout|doordash|uber ?eats|zomato|swiggy/i, 'dining'],
  [/rent|lease/i, 'rent'],
  [/electric|water|gas bill|utilit|power/i, 'utilities'],
  [/internet|wifi|phone|mobile/i, 'internet'],
  [/uber|lyft|taxi|cab|ola/i, 'taxi'],
  [/fuel|petrol|gas station|diesel/i, 'fuel'],
  [/flight|airline|plane|airfare/i, 'flights'],
  [/train|bus|metro|subway|transit/i, 'transport'],
  [/hotel|airbnb|hostel|lodg|stay/i, 'lodging'],
  [/movie|cinema|concert|show|ticket|game/i, 'entertainment'],
  [/netflix|spotify|subscription|prime|disney/i, 'subscriptions'],
  [/gift|present|birthday/i, 'gifts'],
  [/gym|sport|tennis|golf/i, 'sports'],
  [/doctor|pharma|medic|hospital/i, 'health'],
  [/furniture|cleaning|ikea|household/i, 'household'],
  [/shop|clothes|amazon|mall/i, 'shopping'],
];

export function guessCategory(description: string): string | null {
  for (const [re, id] of KEYWORDS) if (re.test(description)) return id;
  return null;
}
