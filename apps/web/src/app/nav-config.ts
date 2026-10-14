import { BarChart3, Calculator, FolderKanban, LayoutList, Truck, type LucideIcon } from 'lucide-react';

export interface NavLeaf {
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  /** Group link when the sidebar is collapsed to icons. */
  to: string;
  children?: NavLeaf[];
}

export const NAV_CONFIG: NavGroup[] = [
  {
    label: 'Projects',
    icon: FolderKanban,
    to: '/projects',
    children: [
      { label: 'Calculate project', to: '/projects/new', icon: Calculator },
      { label: 'Current projects', to: '/projects', icon: LayoutList },
    ],
  },
  { label: 'Delivery tracking', icon: Truck, to: '/deliveries' },
  { label: 'Analytics', icon: BarChart3, to: '/analytics' },
];
