import { Card, SectionTitle } from '../../ui';

export function AssumptionsCard() {
  return (
    <Card>
      <SectionTitle>Assumptions</SectionTitle>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        <li>All amounts are net, excluding 19 % VAT.</li>
        <li>
          The company markup is applied to the whole approved budget: contract
          price = approved × (1 + markup).
        </li>
        <li>
          Forecast (EAC) per row: done → actual; contracted → max(actual,
          committed); planned or partial → max(actual, committed + uncontracted
          remainder).
        </li>
        <li>
          Forecast profit = contract price − forecast; profit erosion = planned
          profit − forecast profit.
        </li>
        <li>
          Cash flow: materials in their delivery month, works spread evenly from
          start to end month, actuals in the delivery (or end) month; rows
          without dates are listed as unscheduled.
        </li>
      </ul>
    </Card>
  );
}
