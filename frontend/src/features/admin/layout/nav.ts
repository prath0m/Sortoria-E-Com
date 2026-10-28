import {
  ArrowLeftRight,
  Boxes,
  FileText,
  FolderTree,
  Gift,
  History,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  MessageSquareQuote,
  Package,
  Receipt,
  Settings,
  SlidersHorizontal,
  Tag,
  Ticket,
  Truck,
  Undo2,
  UserCog,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

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
  {
    label: 'Offers',
    items: [
      { to: '/admin-panel/offers/coupons', label: 'Coupons', icon: Ticket, capability: 'offers.manage' },
      { to: '/admin-panel/offers/sales', label: 'Sales & deals', icon: Zap, capability: 'offers.manage' },
      { to: '/admin-panel/offers/bundles', label: 'Bundles', icon: Gift, capability: 'offers.manage' },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/admin-panel/content', label: 'Homepage', icon: LayoutTemplate, capability: 'cms.manage', end: true },
      { to: '/admin-panel/content/pages', label: 'Pages', icon: FileText, capability: 'cms.manage' },
      { to: '/admin-panel/content/newsletter', label: 'Newsletter', icon: Mail, capability: 'cms.manage' },
    ],
  },
  {
    label: 'Store',
    items: [
      { to: '/admin-panel/shipping', label: 'Shipping', icon: Truck, capability: 'shipping.manage' },
      { to: '/admin-panel/settings', label: 'Settings', icon: Settings, capability: 'settings.manage' },
      { to: '/admin-panel/staff', label: 'Staff', icon: UserCog, capability: 'staff.manage' },
      { to: '/admin-panel/data', label: 'Import & export', icon: ArrowLeftRight, capability: 'export.run' },
      { to: '/admin-panel/activity', label: 'Activity log', icon: History, capability: 'audit.view' },
    ],
  },
];

export function can(capabilities: string[] | undefined, capability: string) {
  return !!capabilities?.includes(capability);
}
