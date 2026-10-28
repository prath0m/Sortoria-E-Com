import { Boxes, FolderTree, LayoutDashboard, MessageSquareQuote, Package, Receipt, SlidersHorizontal, Tag, Undo2, Users, type LucideIcon } from 'lucide-react';

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
  {
    label: 'Sales',
    items: [
      { to: '/admin-panel/orders', label: 'Orders', icon: Receipt, capability: 'orders.view' },
      { to: '/admin-panel/returns', label: 'Returns', icon: Undo2, capability: 'returns.manage' },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { to: '/admin-panel/products', label: 'Products', icon: Package, capability: 'catalog.edit' },
      { to: '/admin-panel/inventory', label: 'Inventory', icon: Boxes, capability: 'inventory.manage' },
      { to: '/admin-panel/categories', label: 'Categories', icon: FolderTree, capability: 'catalog.edit' },
      { to: '/admin-panel/brands', label: 'Brands', icon: Tag, capability: 'catalog.edit' },
      { to: '/admin-panel/attributes', label: 'Attributes', icon: SlidersHorizontal, capability: 'catalog.edit' },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/admin-panel/customers', label: 'Customers', icon: Users, capability: 'customers.view' },
      { to: '/admin-panel/reviews', label: 'Reviews', icon: MessageSquareQuote, capability: 'reviews.manage' },
    ],
  },
];

export function can(capabilities: string[] | undefined, capability: string) {
  return !!capabilities?.includes(capability);
}
