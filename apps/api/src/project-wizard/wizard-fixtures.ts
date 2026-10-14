import type { WizardInput } from '@default-project/types';
import { buildOrganizations } from '../seed-data/organizations';
import { buildTemplateSeed } from '../seed-data/projects';
import { toSnapshot } from '../seed-data/to-snapshot';
import type { TemplateSource } from './wizard-plan';

/** `template-efh-144` exactly as the seed writes it, with synthetic ids (item id = code). Test-only. */
export function templateFixture(): TemplateSource {
  return toSnapshot(
    buildTemplateSeed(),
    buildOrganizations(),
  ) as unknown as TemplateSource;
}

export function wizardInput(over: Partial<WizardInput> = {}): WizardInput {
  return {
    name: 'Haus Müller',
    clientName: 'Familie Müller',
    city: 'Regensburg',
    startDate: '2027-04-01',
    markupBps: 1500,
    land: {
      address: 'Am Brunnenfeld 7',
      postalCode: '93051',
      municipality: 'Regensburg',
      state: 'Bayern',
      areaM2: 600,
      landValuePerM2Cents: 30_000,
      grzBps: 3500,
      gfzBps: 7000,
      maxStoreys: 2,
      soilClass: '3 (DIN 18300, easily excavated)',
      groundwaterDepthCm: 420,
      utilities: [
        { type: 'WATER', status: 'AT_BOUNDARY' },
        { type: 'POWER', status: 'IN_STREET' },
        { type: 'TELECOM', status: 'NOT_AVAILABLE' },
      ],
    },
    house: {
      livingAreaM2: 180,
      storeys: 2,
      energyStandard: 'EH40',
      heating: 'HEAT_PUMP',
      wallType: 'MONOLITHIC_BRICK',
    },
    ...over,
  };
}

export function sequentialIds(prefix = 'new'): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
