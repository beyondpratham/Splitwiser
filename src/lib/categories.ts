import type { SymbolViewProps } from 'expo-symbols';

type SF = Extract<SymbolViewProps['name'], string>;

export interface Category {
  id: string;
  label: string;
  group: 'Food' | 'Home' | 'Transport' | 'Life' | 'Other';
  sf: SF;
  md: string; // Material symbol name for Android / web
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: 'general', label: 'General', group: 'Other', sf: 'square.grid.2x2.fill', md: 'category', color: '#8E8E93' },
  { id: 'groceries', label: 'Groceries', group: 'Food', sf: 'cart.fill', md: 'shopping_cart', color: '#34C759' },
  { id: 'dining', label: 'Dining out', group: 'Food', sf: 'fork.knife', md: 'restaurant', color: '#FF9500' },
  { id: 'coffee', label: 'Coffee', group: 'Food', sf: 'cup.and.saucer.fill', md: 'local_cafe', color: '#A2845E' },
  { id: 'drinks', label: 'Drinks', group: 'Food', sf: 'wineglass.fill', md: 'wine_bar', color: '#AF52DE' },
  { id: 'rent', label: 'Rent', group: 'Home', sf: 'house.fill', md: 'home', color: '#5856D6' },
  { id: 'utilities', label: 'Utilities', group: 'Home', sf: 'bolt.fill', md: 'bolt', color: '#FFCC00' },
  { id: 'internet', label: 'Internet & phone', group: 'Home', sf: 'wifi', md: 'wifi', color: '#32ADE6' },
  { id: 'household', label: 'Household', group: 'Home', sf: 'sofa.fill', md: 'chair', color: '#AC8E68' },
  { id: 'transport', label: 'Transport', group: 'Transport', sf: 'tram.fill', md: 'train', color: '#007AFF' },
  { id: 'taxi', label: 'Taxi', group: 'Transport', sf: 'car.fill', md: 'local_taxi', color: '#FFB800' },
  { id: 'fuel', label: 'Fuel', group: 'Transport', sf: 'fuelpump.fill', md: 'local_gas_station', color: '#FF3B30' },
  { id: 'flights', label: 'Flights', group: 'Transport', sf: 'airplane', md: 'flight', color: '#5AC8FA' },
  { id: 'lodging', label: 'Hotel', group: 'Life', sf: 'bed.double.fill', md: 'hotel', color: '#30B0C7' },
  { id: 'entertainment', label: 'Entertainment', group: 'Life', sf: 'ticket.fill', md: 'local_activity', color: '#FF2D55' },
  { id: 'shopping', label: 'Shopping', group: 'Life', sf: 'bag.fill', md: 'shopping_bag', color: '#FF6482' },
  { id: 'health', label: 'Health', group: 'Life', sf: 'cross.case.fill', md: 'medical_services', color: '#FF453A' },
  { id: 'sports', label: 'Sports', group: 'Life', sf: 'figure.run', md: 'directions_run', color: '#00C7BE' },
  { id: 'gifts', label: 'Gifts', group: 'Life', sf: 'gift.fill', md: 'redeem', color: '#BF5AF2' },
  { id: 'subscriptions', label: 'Subscriptions', group: 'Life', sf: 'play.rectangle.fill', md: 'subscriptions', color: '#E5484D' },
];

export const PAYMENT_CATEGORY: Category = {
  id: 'payment', label: 'Payment', group: 'Other', sf: 'banknote.fill', md: 'payments', color: '#34C759',
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
