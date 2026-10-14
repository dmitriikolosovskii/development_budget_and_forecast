import {
  computeProfitability,
  formatBps,
  formatEur,
} from '@default-project/budget-engine';
import {
  COST_CATEGORIES,
  ENERGY_STANDARDS,
  HEATING_OPTIONS,
  UTILITY_STATUSES,
  UTILITY_TYPES,
  WALL_TYPES,
  type CostCategory,
} from '@default-project/types';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import {
  CATEGORY_COLORS,
  CHART_TOOLTIP_STYLE,
  ChartCard,
  cx,
  FOCUS,
  SOFT,
} from '../../ui';
import type { BudgetEstimate } from './estimate-budget';
import { GERMAN_STATES, transferTaxBps } from './transfer-tax';
import { Field, INPUT_CLASS, ScaledInput } from './wizard-fields';
import type { WizardFormInput } from './wizard-form';

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  LAND: 'Land',
  ARCHITECTURE: 'Architecture',
  MATERIALS: 'Building materials',
  CONSTRUCTION: 'Construction',
  MARKETING: 'Marketing',
};
const ENERGY_LABELS = { EH55: 'KfW EH 55', EH40: 'KfW EH 40' } as const;
const HEATING_LABELS = {
  HEAT_PUMP: 'Heat pump',
  GAS_HYBRID: 'Gas hybrid',
} as const;
const WALL_LABELS = {
  SAND_LIME_ETICS: 'Sand-lime brick + ETICS',
  MONOLITHIC_BRICK: 'Monolithic brick',
} as const;
const UTILITY_LABELS: Record<string, string> = {
  WATER: 'Water',
  SEWER: 'Sewer',
  STORMWATER: 'Stormwater',
  POWER: 'Power',
  GAS: 'Gas',
  TELECOM: 'Telecom',
  DISTRICT_HEATING: 'District heating',
};
const STATUS_LABELS: Record<string, string> = {
  CONNECTED: 'Connected',
  AT_BOUNDARY: 'At plot boundary',
  IN_STREET: 'In the street',
  NOT_AVAILABLE: 'Not available',
};

const GRID = 'grid gap-4 sm:grid-cols-2';
/** `setValueAs` also receives the numeric defaults, not only input strings. */
const intOrNaN = (v: unknown) =>
  typeof v === 'number'
    ? v
    : String(v ?? '').trim() === ''
      ? Number.NaN
      : Number(v);
const optionalInt = (v: unknown) =>
  v === undefined || v === null || String(v).trim() === ''
    ? undefined
    : Number(v);

export function BasicsStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<WizardFormInput>();
  return (
    <div className={GRID}>
      <Field id="wz-name" label="Project name" error={errors.name}>
        <input id="wz-name" className={INPUT_CLASS} {...register('name')} />
      </Field>
      <Field id="wz-client" label="Client" error={errors.clientName}>
        <input
          id="wz-client"
          className={INPUT_CLASS}
          {...register('clientName')}
        />
      </Field>
      <Field id="wz-city" label="City" error={errors.city}>
        <input id="wz-city" className={INPUT_CLASS} {...register('city')} />
      </Field>
      <Field id="wz-start" label="Start date" error={errors.startDate}>
        <input
          id="wz-start"
          type="date"
          className={INPUT_CLASS}
          {...register('startDate')}
        />
      </Field>
      <Field
        id="wz-markup"
        label="Company markup, %"
        error={errors.markupBps}
        hint="Overhead, risk and profit on top of the approved budget"
      >
        <Controller
          control={control}
          name="markupBps"
          render={({ field, fieldState }) => (
            <ScaledInput
              id="wz-markup"
              scale="percent"
              invalid={fieldState.invalid}
              {...field}
            />
          )}
        />
      </Field>
    </div>
  );
}

export function LandStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<WizardFormInput>();
  const state = useWatch<WizardFormInput, 'land.state'>({ name: 'land.state' });
  const tax = transferTaxBps(state ?? '');
  const e = errors.land;
  return (
    <div className="space-y-6">
      <div className={GRID}>
        <Field id="wz-address" label="Address" error={e?.address}>
          <input
            id="wz-address"
            className={INPUT_CLASS}
            {...register('land.address')}
          />
        </Field>
        <Field id="wz-postal" label="Postal code" error={e?.postalCode}>
          <input
            id="wz-postal"
            className={INPUT_CLASS}
            {...register('land.postalCode')}
          />
        </Field>
        <Field
          id="wz-municipality"
          label="Municipality"
          error={e?.municipality}
        >
          <input
            id="wz-municipality"
            className={INPUT_CLASS}
            {...register('land.municipality')}
          />
        </Field>
        <Field
          id="wz-state"
          label="State (Bundesland)"
          error={e?.state}
          hint={`Real-estate transfer tax ${formatBps(tax.bps)}${tax.estimated ? ' (est.)' : ''}`}
        >
          <input
            id="wz-state"
            list="wz-states"
            className={INPUT_CLASS}
            {...register('land.state')}
          />
          <datalist id="wz-states">
            {GERMAN_STATES.filter((s) => s.bps !== null).map((s) => (
              <option key={s.name} value={s.name} />
            ))}
          </datalist>
        </Field>
        <Field id="wz-area" label="Plot area, m²" error={e?.areaM2}>
          <input
            id="wz-area"
            inputMode="numeric"
            className={INPUT_CLASS}
            {...register('land.areaM2', { setValueAs: intOrNaN })}
          />
        </Field>
        <Field
          id="wz-value"
          label="Land value, € per m²"
          error={e?.landValuePerM2Cents}
          hint="Bodenrichtwert"
        >
          <Controller
            control={control}
            name="land.landValuePerM2Cents"
            render={({ field, fieldState }) => (
              <ScaledInput
                id="wz-value"
                scale="money"
                invalid={fieldState.invalid}
                {...field}
              />
            )}
          />
        </Field>
        <Field id="wz-grz" label="GRZ (site coverage ratio)" error={e?.grzBps}>
          <Controller
            control={control}
            name="land.grzBps"
            render={({ field, fieldState }) => (
              <ScaledInput
                id="wz-grz"
                scale="ratio"
                invalid={fieldState.invalid}
                {...field}
              />
            )}
          />
        </Field>
        <Field id="wz-gfz" label="GFZ (floor area ratio)" error={e?.gfzBps}>
          <Controller
            control={control}
            name="land.gfzBps"
            render={({ field, fieldState }) => (
              <ScaledInput
                id="wz-gfz"
                scale="ratio"
                invalid={fieldState.invalid}
                {...field}
              />
            )}
          />
        </Field>
        <Field id="wz-max-storeys" label="Max. storeys" error={e?.maxStoreys}>
          <input
            id="wz-max-storeys"
            inputMode="numeric"
            className={INPUT_CLASS}
            {...register('land.maxStoreys', { setValueAs: intOrNaN })}
          />
        </Field>
        <Field id="wz-soil" label="Soil class" error={e?.soilClass}>
          <input
            id="wz-soil"
            className={INPUT_CLASS}
            {...register('land.soilClass')}
          />
        </Field>
        <Field
          id="wz-groundwater"
          label="Groundwater depth, cm (optional)"
          error={e?.groundwaterDepthCm}
        >
          <input
            id="wz-groundwater"
            inputMode="numeric"
            className={INPUT_CLASS}
            {...register('land.groundwaterDepthCm', {
              setValueAs: optionalInt,
            })}
          />
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">Utilities</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {UTILITY_TYPES.map((type, i) => (
            <Field
              key={type}
              id={`wz-util-${type}`}
              label={UTILITY_LABELS[type]}
            >
              <select
                id={`wz-util-${type}`}
                className={INPUT_CLASS}
                {...register(`land.utilities.${i}.status`)}
              >
                {UTILITY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function HouseStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<WizardFormInput>();
  const e = errors.house;
  return (
    <div className="space-y-4">
      <div className={GRID}>
        <Field
          id="wz-living"
          label="Living area, m²"
          error={e?.livingAreaM2}
          hint="100–250 m²; the 144 m² template is scaled to it"
        >
          <input
            id="wz-living"
            inputMode="numeric"
            className={INPUT_CLASS}
            {...register('house.livingAreaM2', { setValueAs: intOrNaN })}
          />
        </Field>
        <Field id="wz-storeys" label="Storeys" error={e?.storeys}>
          <select
            id="wz-storeys"
            className={INPUT_CLASS}
            {...register('house.storeys', {
              setValueAs: (v: unknown) => Number(v),
            })}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </Field>
        <Field id="wz-energy" label="Energy standard" error={e?.energyStandard}>
          <select
            id="wz-energy"
            className={INPUT_CLASS}
            {...register('house.energyStandard')}
          >
            {ENERGY_STANDARDS.map((v) => (
              <option key={v} value={v}>
                {ENERGY_LABELS[v]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="wz-heating" label="Heating" error={e?.heating}>
          <select
            id="wz-heating"
            className={INPUT_CLASS}
            {...register('house.heating')}
          >
            {HEATING_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {HEATING_LABELS[v]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="wz-walls" label="Wall type" error={e?.wallType}>
          <select
            id="wz-walls"
            className={INPUT_CLASS}
            {...register('house.wallType')}
          >
            {WALL_TYPES.map((v) => (
              <option key={v} value={v}>
                {WALL_LABELS[v]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-sm text-muted">
        Storeys, energy standard, heating and walls describe the house; the cost
        follows the living area.
      </p>
    </div>
  );
}

interface BudgetStepProps {
  estimate: BudgetEstimate;
  onEdit: (category: CostCategory) => void;
  onReset: () => void;
}

export function BudgetStep({ estimate, onEdit, onReset }: BudgetStepProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<WizardFormInput>();
  const { land } = estimate;
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 pr-3 font-medium">Category</th>
              <th className="py-2 pr-3 text-right font-medium">Planned cost</th>
              <th className="py-2 pr-3 text-right font-medium">Estimate</th>
              <th className="py-2 font-medium">Approved budget, €</th>
            </tr>
          </thead>
          <tbody>
            {COST_CATEGORIES.map((c) => (
              <tr
                key={c}
                className="border-b border-line/60"
                data-testid={`estimate-${c}`}
              >
                <th
                  scope="row"
                  className="py-2 pr-3 text-left font-medium text-ink"
                >
                  {CATEGORY_LABELS[c]}
                </th>
                <td className="py-2 pr-3 text-right tabular-nums text-muted">
                  {formatEur(estimate.plannedByCategory[c])}
                </td>
                <td
                  className="py-2 pr-3 text-right tabular-nums"
                  data-testid={`estimate-value-${c}`}
                >
                  {formatEur(estimate.approvedByCategory[c])}
                </td>
                <td className="py-2">
                  <Controller
                    control={control}
                    name={`approvedByCategory.${c}`}
                    render={({ field, fieldState }) => (
                      <>
                        <label
                          htmlFor={`wz-approved-${c}`}
                          className="sr-only"
                        >{`Approved ${CATEGORY_LABELS[c]}`}</label>
                        <ScaledInput
                          id={`wz-approved-${c}`}
                          scale="money"
                          invalid={fieldState.invalid}
                          value={field.value}
                          onBlur={field.onBlur}
                          onChange={(v) => {
                            onEdit(c);
                            field.onChange(v);
                          }}
                        />
                        {errors.approvedByCategory?.[c] && (
                          <p role="alert" className="text-xs text-risk-600">
                            Enter an amount like 1,234.56
                          </p>
                        )}
                      </>
                    )}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <p>
          Land: purchase {formatEur(land.purchase)} · transfer tax{' '}
          {formatBps(land.transferTaxBps)}
          {land.taxEstimated ? ' (est.)' : ''} {formatEur(land.transferTax)} ·
          notary {formatEur(land.notary)} · land registry{' '}
          {formatEur(land.registry)}
        </p>
        <button
          type="button"
          onClick={onReset}
          className={cx(
            'rounded-lg px-3 py-1.5 text-brand-600 hover:bg-brand-50',
            SOFT,
            FOCUS,
          )}
        >
          Reset to estimate
        </button>
      </div>
    </div>
  );
}

interface ReviewStepProps {
  values: WizardFormInput;
  estimate: BudgetEstimate;
}

export function ReviewStep({ values, estimate }: ReviewStepProps) {
  const approved = COST_CATEGORIES.reduce(
    (s, c) => s + (values.approvedByCategory?.[c] ?? 0),
    0,
  );
  const p = computeProfitability(
    { approved, forecast: estimate.plannedTotal },
    values.markupBps,
  );
  const slices = COST_CATEGORIES.map((c) => ({
    category: c,
    name: CATEGORY_LABELS[c],
    value: values.approvedByCategory?.[c] ?? 0,
  })).filter((s) => s.value > 0);
  const rows: Array<[string, string]> = [
    ['Project', `${values.name} · ${values.clientName} · ${values.city}`],
    ['Start', values.startDate],
    [
      'Plot',
      `${values.land.areaM2} m², ${values.land.municipality} (${values.land.state})`,
    ],
    [
      'House',
      `${values.house.livingAreaM2} m², ${values.house.storeys} storey(s), ${ENERGY_LABELS[values.house.energyStandard]}, ${HEATING_LABELS[values.house.heating]}`,
    ],
    ['Approved budget', formatEur(approved)],
    ['Contract price', formatEur(p.contractPrice)],
    ['Planned profit', formatEur(p.plannedProfit)],
    ['Expected margin', formatBps(p.marginBps)],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd
              className="font-medium text-ink tabular-nums"
              data-testid={`review-${k.toLowerCase().replace(/ /g, '-')}`}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <ChartCard title="Budget structure" height={220}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {slices.map((s) => (
              <Cell key={s.category} fill={CATEGORY_COLORS[s.category]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => formatEur(Number(v))}
            {...CHART_TOOLTIP_STYLE}
          />
        </PieChart>
      </ChartCard>
    </div>
  );
}
