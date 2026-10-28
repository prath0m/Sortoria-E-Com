import { LayoutDashboard, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  capability: string;
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Sidebar sections. Items appear only for staff holding the capability (enforced again by the API). */
export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ to: '/admin-panel', label: 'Dashboard', icon: LayoutDashboard, capability: 'dashboard.view', end: true }],
  },
];

export function can(capabilities: string[] | undefined, capability: string) {
  return !!capabilities?.includes(capability);
}
