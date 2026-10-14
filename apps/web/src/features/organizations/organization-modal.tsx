import { useCallback } from 'react';
import { formatDate } from '@default-project/budget-engine';
import type { CostItem, Organization } from '@default-project/types';
import { Mail, Phone, Star, Globe } from 'lucide-react';
import { Modal } from '../../ui/modal';
import { Badge } from '../../ui/badge';
import { EmptyState, ErrorState } from '../../ui/states';
import { Skeleton } from '../../ui/skeleton';
import { ScheduleBadge } from '../../ui/editable-table/cells';
import { useProjectSnapshot } from '../project/use-project-snapshot';
import { useSchedule } from '../project/use-schedule';
import type { ProjectCache } from '../project/project-cache';
import { useOrganizations } from './use-organizations';

export interface OrganizationModalProps {
  orgId: string | null;
  projectId: string;
  onClose: () => void;
}

const ROLE_LABEL: Record<Organization['role'], string> = {
  SUPPLIER: 'Supplier',
  CONTRACTOR: 'Contractor',
  CONSULTANT: 'Consultant',
  AGENCY: 'Agency',
  AUTHORITY: 'Authority',
};

/** Only safe http(s) links are rendered for the website. */
function safeWebsite(url: string | null): string | null {
  if (!url) return null;
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function itemDates(item: CostItem): string {
  if (item.kind === 'MATERIAL') {
    if (item.deliveredDate) return `Delivered ${formatDate(item.deliveredDate)}`;
    return item.deliveryDate ? `Delivery ${formatDate(item.deliveryDate)}` : 'No delivery date';
  }
  if (item.startDate && item.endDate) return `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`;
  return item.startDate ? `Starts ${formatDate(item.startDate)}` : 'No dates';
}

function OrgRows({ projectId, orgId }: { projectId: string; orgId: string }) {
  const select = useCallback(
    (c: ProjectCache) => c.items.filter((i) => i.supplierId === orgId || i.contractorId === orgId),
    [orgId],
  );
  const rows = useProjectSnapshot(projectId, select).data ?? [];
  const schedule = useSchedule(projectId);
  if (rows.length === 0) return <p className="text-sm text-muted">No rows in this project.</p>;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {rows.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="mr-2 font-mono text-xs text-muted">{item.code}</span>
            {item.name}
          </span>
          <span className="flex items-center gap-2 text-muted">
            {itemDates(item)}
            {schedule[item.id] && <ScheduleBadge result={schedule[item.id]} />}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Organisation details, contacts (tel:/mailto:) and its deadlines in this project. */
export function OrganizationModal({ orgId, projectId, onClose }: OrganizationModalProps) {
  const selectOrg = useCallback((c: ProjectCache) => (orgId ? c.orgsById[orgId] : undefined), [orgId]);
  const fromProject = useProjectSnapshot(projectId, selectOrg).data;
  const all = useOrganizations();
  const org = fromProject ?? all.data?.find((o) => o.id === orgId);
  const website = safeWebsite(org?.website ?? null);

  let body;
  if (org) {
    body = (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{ROLE_LABEL[org.role]}</Badge>
          {org.rating !== null && (
            <Badge tone="warn" title="Rating">
              <Star aria-hidden className="h-3 w-3" /> {org.rating}/5
            </Badge>
          )}
          <span className="text-sm text-muted">
            {org.address}, {org.city}
          </span>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Contact person</dt>
            <dd className="font-medium">
              {org.contactPerson} <span className="font-normal text-muted">· {org.contactRole}</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Payment terms</dt>
            <dd>{org.paymentTermsDays} days</dd>
          </div>
          <div>
            <dt className="text-muted">Phone</dt>
            <dd>
              <a className="inline-flex items-center gap-1 text-brand-600 hover:underline" href={`tel:${encodeURIComponent(org.phone.replace(/\s+/g, ''))}`}>
                <Phone aria-hidden className="h-3.5 w-3.5" />
                {org.phone}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Email</dt>
            <dd>
              <a className="inline-flex items-center gap-1 text-brand-600 hover:underline" href={`mailto:${encodeURIComponent(org.email)}`}>
                <Mail aria-hidden className="h-3.5 w-3.5" />
                {org.email}
              </a>
            </dd>
          </div>
          {website && (
            <div>
              <dt className="text-muted">Website</dt>
              <dd>
                <a className="inline-flex items-center gap-1 text-brand-600 hover:underline" href={website} target="_blank" rel="noreferrer noopener">
                  <Globe aria-hidden className="h-3.5 w-3.5" />
                  {org.website}
                </a>
              </dd>
            </div>
          )}
        </dl>
        {org.notes && <p className="rounded-lg bg-subtle p-3 text-sm">{org.notes}</p>}
        <section>
          <h3 className="mb-2 text-sm font-semibold">Deadlines in this project</h3>
          <OrgRows projectId={projectId} orgId={org.id} />
        </section>
      </div>
    );
  } else if (all.isError) {
    body = <ErrorState error={all.error} retry={() => void all.refetch()} />;
  } else if (all.isPending) {
    body = <Skeleton lines={4} />;
  } else {
    body = <EmptyState title="Organisation not found" />;
  }

  const title = org ? `${org.name}${org.legalForm && !org.name.endsWith(org.legalForm) ? ` ${org.legalForm}` : ''}` : 'Organisation';
  return (
    <Modal open={orgId !== null} onClose={onClose} title={title}>
      {body}
    </Modal>
  );
}
