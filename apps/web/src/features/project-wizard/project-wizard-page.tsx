import {
  COST_CATEGORIES,
  type CostCategory,
  type WizardInput,
} from '@default-project/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { ApiError } from '../../lib/api-client';
import { Card, cx, ErrorState, FOCUS, Skeleton, SOFT } from '../../ui';
import { useToday } from '../project/use-today';
import { estimateBudget } from './estimate-budget';
import { useCreateFromWizard, useWizardTemplate } from './use-wizard';
import {
  STEP_FIELDS,
  STEPS,
  wizardDefaults,
  wizardFormSchema,
  type WizardFormInput,
  type WizardFormValues,
} from './wizard-form';
import {
  BasicsStep,
  BudgetStep,
  HouseStep,
  LandStep,
  ReviewStep,
} from './wizard-steps';

const BUDGET_STEP = 3;
const REVIEW_STEP = 4;
const BUTTON = cx(
  'rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50',
  SOFT,
  FOCUS,
);

/** `/projects/new`: calculate a new project from the 144 m² template in five steps (block 12). */
export function ProjectWizardPage() {
  const today = useToday();
  const template = useWizardTemplate();
  const create = useCreateFromWizard();
  const form = useForm<WizardFormInput, unknown, WizardFormValues>({
    resolver: zodResolver(wizardFormSchema),
    defaultValues: wizardDefaults(today),
    mode: 'onTouched',
  });
  const { control, setValue, trigger, handleSubmit, getValues } = form;
  const [step, setStep] = useState(0);
  const [edited, setEdited] = useState<ReadonlySet<CostCategory>>(
    () => new Set(),
  );

  const [livingAreaM2, areaM2, landValuePerM2Cents, state] = useWatch({
    control,
    name: [
      'house.livingAreaM2',
      'land.areaM2',
      'land.landValuePerM2Cents',
      'land.state',
    ],
  });
  const estimate = useMemo(
    () =>
      template.data
        ? estimateBudget(
            { livingAreaM2, land: { areaM2, landValuePerM2Cents, state } },
            template.data,
          )
        : null,
    [template.data, livingAreaM2, areaM2, landValuePerM2Cents, state],
  );
  // Approved amounts follow the estimate until the user edits that category.
  useEffect(() => {
    if (!estimate) return;
    for (const c of COST_CATEGORIES) {
      if (!edited.has(c))
        setValue(`approvedByCategory.${c}`, estimate.approvedByCategory[c]);
    }
  }, [estimate, edited, setValue]);

  const needsTemplate = step >= BUDGET_STEP;
  const submit = handleSubmit((values) => create.mutate(values as WizardInput));
  const next = async () => {
    if (needsTemplate && !estimate) return;
    if (await trigger(STEP_FIELDS[step], { shouldFocus: true }))
      setStep((s) => Math.min(s + 1, REVIEW_STEP));
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < REVIEW_STEP) void next();
    else if (!create.isPending) void submit();
  };

  let body;
  if (needsTemplate && template.isPending) body = <Skeleton lines={6} />;
  else if (needsTemplate && (template.isError || !estimate))
    body = (
      <ErrorState
        title="Could not load the project template"
        error={template.error}
        retry={() => void template.refetch()}
      />
    );
  else if (step === 0) body = <BasicsStep />;
  else if (step === 1) body = <LandStep />;
  else if (step === 2) body = <HouseStep />;
  else if (step === BUDGET_STEP && estimate)
    body = (
      <BudgetStep
        estimate={estimate}
        onEdit={(c) => setEdited((s) => new Set(s).add(c))}
        onReset={() => setEdited(new Set())}
      />
    );
  else if (estimate)
    body = <ReviewStep values={getValues()} estimate={estimate} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-ink">Calculate project</h1>
        <p className="text-sm text-muted">
          A new project from the 144 m² Stadtvilla template, scaled to your plot
          and house.
        </p>
      </div>
      <ol aria-label="Wizard steps" className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={cx(
              'rounded-full px-3 py-1',
              SOFT,
              i === step
                ? 'bg-brand-500 text-white'
                : i < step
                  ? 'bg-brand-50 text-brand-600'
                  : 'bg-subtle text-muted',
            )}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      <Card>
        <FormProvider {...form}>
          <form noValidate onSubmit={onSubmit} className="space-y-6">
            <h2 className="text-lg font-semibold text-ink">{STEPS[step]}</h2>
            {body}
            {create.isError && (
              <p role="alert" className="text-sm text-risk-600">
                Could not create the project:{' '}
                {create.error instanceof ApiError
                  ? create.error.message
                  : 'unexpected error'}
              </p>
            )}
            <div className="flex justify-between gap-2 border-t border-line pt-4">
              <button
                type="button"
                className={cx(BUTTON, 'text-ink hover:bg-subtle')}
                disabled={step === 0 || create.isPending}
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
              >
                Back
              </button>
              {step < REVIEW_STEP ? (
                <button
                  type="submit"
                  className={cx(
                    BUTTON,
                    'bg-brand-500 text-white hover:bg-brand-600',
                  )}
                  disabled={needsTemplate && !estimate}
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  className={cx(
                    BUTTON,
                    'bg-brand-500 text-white hover:bg-brand-600',
                  )}
                  disabled={create.isPending}
                >
                  {create.isPending ? 'Creating…' : 'Create project'}
                </button>
              )}
            </div>
          </form>
        </FormProvider>
      </Card>
    </div>
  );
}
