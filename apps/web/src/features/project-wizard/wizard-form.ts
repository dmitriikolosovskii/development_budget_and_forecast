import {
  centsSchema,
  costCategorySchema,
  UTILITY_TYPES,
  wizardInputSchema,
  type UtilityStatus,
  type UtilityType,
} from '@default-project/types';
import type { FieldPath } from 'react-hook-form';
import { z } from 'zod';

export const MIN_LIVING_AREA_M2 = 100;
export const MAX_LIVING_AREA_M2 = 250;
const AREA_MESSAGE = `Living area must be ${MIN_LIVING_AREA_M2}–${MAX_LIVING_AREA_M2} m²`;

/** The shared contract, narrowed to the wizard's range; the per-category amounts are always sent. */
export const wizardFormSchema = wizardInputSchema.extend({
  house: wizardInputSchema.shape.house.extend({
    livingAreaM2: z
      .number()
      .int()
      .min(MIN_LIVING_AREA_M2, AREA_MESSAGE)
      .max(MAX_LIVING_AREA_M2, AREA_MESSAGE),
  }),
  approvedByCategory: z.record(costCategorySchema, centsSchema),
});
export type WizardFormInput = z.input<typeof wizardFormSchema>;
export type WizardFormValues = z.output<typeof wizardFormSchema>;

export const STEPS = ['Basics', 'Land', 'House', 'Budget', 'Review'] as const;

/** Fields validated by "Next" on each step (Review submits the whole form). */
export const STEP_FIELDS: ReadonlyArray<FieldPath<WizardFormInput>[]> = [
  ['name', 'clientName', 'city', 'startDate', 'markupBps'],
  ['land'],
  ['house'],
  ['approvedByCategory'],
  [],
];

const DEFAULT_UTILITY: Record<UtilityType, UtilityStatus> = {
  WATER: 'AT_BOUNDARY',
  SEWER: 'AT_BOUNDARY',
  STORMWATER: 'AT_BOUNDARY',
  POWER: 'AT_BOUNDARY',
  GAS: 'NOT_AVAILABLE',
  TELECOM: 'IN_STREET',
  DISTRICT_HEATING: 'NOT_AVAILABLE',
};

/** First day of the month after `today` (YYYY-MM-DD). */
export function nextMonthStart(today: string): string {
  const [y, m] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

export function wizardDefaults(today: string): WizardFormInput {
  return {
    name: '',
    clientName: '',
    city: '',
    startDate: nextMonthStart(today),
    markupBps: 1500,
    land: {
      address: '',
      postalCode: '',
      municipality: '',
      state: 'Sachsen',
      areaM2: 520,
      landValuePerM2Cents: 13_000,
      grzBps: 4000,
      gfzBps: 8000,
      maxStoreys: 2,
      soilClass: '3 (DIN 18300, easily excavated)',
      groundwaterDepthCm: undefined,
      utilities: UTILITY_TYPES.map((type) => ({
        type,
        status: DEFAULT_UTILITY[type],
      })),
    },
    house: {
      livingAreaM2: 144,
      storeys: 2,
      energyStandard: 'EH55',
      heating: 'HEAT_PUMP',
      wallType: 'SAND_LIME_ETICS',
    },
    approvedByCategory: {
      LAND: 0,
      ARCHITECTURE: 0,
      MATERIALS: 0,
      CONSTRUCTION: 0,
      MARKETING: 0,
    },
  };
}
