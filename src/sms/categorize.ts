import type { Category } from '@/data/types';

// Common Indian merchants -> default category names seeded for every user
const RULES: [RegExp, string][] = [
  [/swiggy|zomato|domino|pizza|kfc|mcdonald|burger|starbucks|cafe|restaurant|eatsure|chai/i, 'Food & Dining'],
  [/blinkit|zepto|bigbasket|instamart|dmart|grocer|jiomart|more retail|reliance smart|kirana/i, 'Groceries'],
  [/uber|ola|rapido|metro|irctc|redbus|petrol|fuel|hpcl|bpcl|indian oil|fastag|parking/i, 'Transport'],
  [/amazon|flipkart|myntra|ajio|meesho|nykaa|croma|tata cliq|decathlon/i, 'Shopping'],
  [/airtel|jio|vodafone|\bvi\b|bescom|electricity|tata power|adani|gas|broadband|recharge|act fibernet/i, 'Bills & Utilities'],
  [/netflix|hotstar|prime video|spotify|bookmyshow|pvr|inox|youtube|sonyliv|zee5/i, 'Entertainment'],
  [/apollo|pharm|medplus|1mg|netmeds|hospital|clinic|practo|diagnostic/i, 'Health'],
  [/rent|nobroker|landlord/i, 'Rent'],
  [/school|college|udemy|coursera|byju|unacademy|fees/i, 'Education'],
  [/salary|payroll/i, 'Salary'],
];

export function guessCategory(text: string | null, kind: 'expense' | 'income', categories: Category[]): string | null {
  const pool = categories.filter((c) => c.kind === kind);
  if (text) {
    for (const [re, name] of RULES) {
      if (re.test(text)) {
        const hit = pool.find((c) => c.name === name);
        if (hit) return hit.id;
      }
    }
  }
  return null;
}
