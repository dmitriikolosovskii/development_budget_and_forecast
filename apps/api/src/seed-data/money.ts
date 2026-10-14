import { itemPlannedCents, parseEurToCents, parseQtyToMilli } from '@default-project/budget-engine';

// Seed tables write money and quantities as decimal strings; conversion never goes through floats.
export const eur = (amount: string): number => parseEurToCents(amount);
export const qty = (quantity: string): number => parseQtyToMilli(quantity);
export { itemPlannedCents };
