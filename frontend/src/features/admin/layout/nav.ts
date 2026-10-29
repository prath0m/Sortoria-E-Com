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
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, capability: 'dashboard.view', end: true }],
  },
  {
    label: 'Sales',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: Receipt, capability: 'orders.view' },
      { to: '/admin/returns', label: 'Returns', icon: Undo2, capability: 'returns.manage' },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { to: '/admin/products', label: 'Products', icon: Package, capability: 'catalog.edit' },
      { to: '/admin/inventory', label: 'Inventory', icon: Boxes, capability: 'inventory.manage' },
      { to: '/admin/categories', label: 'Categories', icon: FolderTree, capability: 'catalog.edit' },
      { to: '/admin/brands', label: 'Brands', icon: Tag, capability: 'catalog.edit' },
      { to: '/admin/attributes', label: 'Attributes', icon: SlidersHorizontal, capability: 'catalog.edit' },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/admin/customers', label: 'Customers', icon: Users, capability: 'customers.view' },
      { to: '/admin/reviews', label: 'Reviews', icon: MessageSquareQuote, capability: 'reviews.manage' },
    ],
  },
  {
    label: 'Offers',
    items: [
      { to: '/admin/offers/coupons', label: 'Coupons', icon: Ticket, capability: 'offers.manage' },
      { to: '/admin/offers/sales', label: 'Sales & deals', icon: Zap, capability: 'offers.manage' },
      { to: '/admin/offers/bundles', label: 'Bundles', icon: Gift, capability: 'offers.manage' },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/admin/content', label: 'Homepage', icon: LayoutTemplate, capability: 'cms.manage', end: true },
      { to: '/admin/content/pages', label: 'Pages', icon: FileText, capability: 'cms.manage' },
      { to: '/admin/content/newsletter', label: 'Newsletter', icon: Mail, capability: 'cms.manage' },
    ],
  },
  {
    label: 'Store',
    items: [
      { to: '/admin/shipping', label: 'Shipping', icon: Truck, capability: 'shipping.manage' },
      { to: '/admin/settings', label: 'Settings', icon: Settings, capability: 'settings.manage' },
      { to: '/admin/staff', label: 'Staff', icon: UserCog, capability: 'staff.manage' },
      { to: '/admin/data', label: 'Import & export', icon: ArrowLeftRight, capability: 'export.run' },
      { to: '/admin/activity', label: 'Activity log', icon: History, capability: 'audit.view' },
    ],
  },
];

export function can(capabilities: string[] | undefined, capability: string) {
  return !!capabilities?.includes(capability);
}
