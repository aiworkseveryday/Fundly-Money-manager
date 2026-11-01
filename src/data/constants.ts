import type { AccountType, BillFrequency } from './types';

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash', icon: 'cash' },
  { value: 'bank', label: 'Bank', icon: 'bank' },
  { value: 'upi', label: 'UPI / Wallet', icon: 'cellphone' },
  { value: 'credit', label: 'Credit card', icon: 'credit-card' },
];

export const CATEGORY_ICONS = [
  'food', 'cart', 'car', 'bus', 'train', 'airplane', 'gas-station', 'shopping', 'tshirt-crew', 'flash',
  'water', 'wifi', 'cellphone', 'home', 'medical-bag', 'pill', 'dumbbell', 'movie-open', 'gamepad-variant',
  'music', 'school', 'book-open-variant', 'gift', 'heart', 'paw', 'baby-carriage', 'coffee', 'glass-cocktail',
  'briefcase', 'laptop', 'cash-plus', 'bank-transfer', 'chart-line', 'hand-coin', 'tag', 'dots-horizontal',
];

export const BILL_FREQUENCIES: { value: BillFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'once', label: 'One time' },
];
