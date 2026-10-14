import type { SectionTab } from '../../lib/ui-store';

export interface ProjectTab {
  /** Route segment under /projects/:projectId. */
  path: 'land' | 'architecture' | 'materials' | 'construction' | 'marketing' | 'profitability';
  label: string;
  /** Tabs with sub-sections remember the last one in useUiStore.lastSection. */
  sectionTab?: SectionTab;
}

export const PROJECT_TABS: ProjectTab[] = [
  { path: 'land', label: 'Land' },
  { path: 'architecture', label: 'Architecture' },
  { path: 'materials', label: 'Building materials', sectionTab: 'materials' },
  { path: 'construction', label: 'Construction', sectionTab: 'construction' },
  { path: 'marketing', label: 'Marketing', sectionTab: 'marketing' },
  { path: 'profitability', label: 'Profitability' },
];
