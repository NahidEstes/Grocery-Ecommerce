import { can, type Permission } from "./management";
import type {
  Account,
  StoreSettings,
  SupportTicket,
  Review,
} from "./storefront";
import type { Product } from "./catalog";
import type { Order, OrderStatus } from "./orders";
import { deliverySlots, formatDelivery } from "./orders";
// Calendar identity must not depend on a browser's en-CA display convention.
export function adminCalendarDate(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export type AdminOverviewData = {
  stockThreshold: number;
  support: SupportTicket[];
  products: Product[];
  orders: Order[];
  settings: StoreSettings;
  reviews: Review[];
  storage: string;
  metrics: {
    orders: number;
    revenue: number;
    delivered: number;
    pending: number;
    lowStock: number;
  };
};
export const adminTools = [
  {
    id: "overview",
    label: "Overview",
    group: "Workspace",
    permission: "reports",
    icon: "overview",
  },
  {
    id: "orders",
    label: "Orders",
    group: "Daily operations",
    permission: "orders",
    icon: "orders",
  },
  {
    id: "inventory",
    label: "Inventory & alerts",
    group: "Daily operations",
    permission: "products",
    icon: "inventory",
  },
  {
    id: "returns",
    label: "Returns & refunds",
    group: "Daily operations",
    permission: "returns",
    icon: "returns",
  },
  {
    id: "products",
    label: "Products & stock",
    group: "Catalog",
    permission: "products",
    icon: "products",
  },
  {
    id: "purchasing",
    label: "Suppliers & batches",
    group: "Catalog",
    permission: "purchasing",
    icon: "inventory",
  },
  {
    id: "catalog-tools",
    label: "Bulk updates & CSV",
    group: "Catalog",
    permission: "products",
    icon: "products",
  },
  {
    id: "homepage",
    label: "Homepage editor",
    group: "Content",
    permission: "content",
    icon: "content",
  },
  {
    id: "recipes",
    label: "Recipes",
    group: "Content",
    permission: "content",
    icon: "recipes",
  },
  {
    id: "languages",
    label: "English / বাংলা content",
    group: "Content",
    permission: "content",
    icon: "languages",
  },
  {
    id: "search",
    label: "Search & alerts",
    group: "Content",
    permission: "content",
    icon: "search",
  },
  {
    id: "reviews",
    label: "Customer reviews",
    group: "Customers",
    permission: "reviews",
    icon: "reviews",
  },
  {
    id: "support",
    label: "Customer support",
    group: "Customers",
    permission: "support",
    icon: "support",
  },
  {
    id: "reports",
    label: "Sales & promo reports",
    group: "Business & settings",
    permission: "reports",
    icon: "overview",
  },
  {
    id: "storefront",
    label: "Storefront settings",
    group: "Business & settings",
    permission: "content",
    icon: "settings",
  },
  {
    id: "team",
    label: "Staff & permissions",
    group: "Business & settings",
    permission: "team",
    icon: "team",
  },
  {
    id: "activity",
    label: "Activity history",
    group: "Business & settings",
    permission: "audit",
    icon: "activity",
  },
] as const satisfies readonly {
  id: string;
  label: string;
  group: string;
  permission: Permission;
  icon: string;
}[];
export type AdminSection = (typeof adminTools)[number]["id"];
export type StaffAccountRole = Account["role"] | undefined;
export function allowedAdminTools(role: StaffAccountRole) {
  return adminTools.filter((tool) => can(role, tool.permission));
}
export function resolveAdminSection(
  requested: string | undefined,
  role: StaffAccountRole,
): AdminSection | null {
  const allowed = allowedAdminTools(role);
  return (
    allowed.find((tool) => tool.id === requested)?.id ||
    allowed.find((tool) => tool.id === "overview")?.id ||
    allowed.find((tool) => tool.id === "products")?.id ||
    allowed.find((tool) => tool.id === "orders")?.id ||
    allowed[0]?.id ||
    null
  );
}
export const orderStatuses: { id: OrderStatus; label: string }[] = [
  { id: "placed", label: "New" },
  { id: "preparing", label: "Preparing" },
  { id: "out-for-delivery", label: "Out for delivery" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];
export const nextOrderStatuses: Record<OrderStatus, OrderStatus[]> = {
  placed: ["preparing", "cancelled"],
  preparing: ["out-for-delivery", "cancelled"],
  "out-for-delivery": ["delivered"],
  delivered: [],
  cancelled: [],
};
export const orderStatusLabel = (status: OrderStatus) =>
  orderStatuses.find((item) => item.id === status)?.label || status;
export const isOpenOrder = (order: Order) =>
  !["delivered", "cancelled"].includes(order.status);
export function adminOrderDelivery(order: Order) {
  const selection = order.deliverySelection;
  return selection?.date &&
    deliverySlots.some((slot) => slot.id === selection.slot)
    ? formatDelivery(selection)
    : "Not scheduled";
}
export type OrderFilters = {
  query: string;
  status: string;
  area: string;
  payment: string;
  from: string;
  to: string;
  deliveryDate: string;
  sort: "newest" | "oldest" | "delivery";
};
export const emptyOrderFilters: OrderFilters = {
  query: "",
  status: "",
  area: "",
  payment: "",
  from: "",
  to: "",
  deliveryDate: "",
  sort: "newest",
};
export function filterAdminOrders(
  orders: Order[],
  filters: OrderFilters,
  timeZone: string,
) {
  const query = filters.query.trim().toLocaleLowerCase();
  return orders
    .filter((order) => {
      const created = adminCalendarDate(
        new Date(order.createdAt),
        order.timeZone || timeZone,
      );
      return (
        (!query ||
          `${order.reference} ${order.customer.name} ${order.customer.phone} ${order.customer.area}`
            .toLocaleLowerCase()
            .includes(query)) &&
        (!filters.status ||
          (filters.status === "open"
            ? isOpenOrder(order)
            : order.status === filters.status)) &&
        (!filters.area || order.customer.area === filters.area) &&
        (!filters.payment ||
          (filters.payment === "cod"
            ? order.payment === "cash-on-delivery"
            : order.payment === "online" &&
              (order.paymentStatus || "pending") === filters.payment)) &&
        (!filters.from || created >= filters.from) &&
        (!filters.to || created <= filters.to) &&
        (!filters.deliveryDate ||
          (isOpenOrder(order) &&
            order.deliverySelection?.date === filters.deliveryDate))
      );
    })
    .sort((a, b) =>
      filters.sort === "delivery"
        ? (a.deliverySelection?.date || "9999-12-31").localeCompare(
            b.deliverySelection?.date || "9999-12-31",
          ) ||
          deliverySlots.findIndex(
            (slot) => slot.id === a.deliverySelection?.slot,
          ) -
            deliverySlots.findIndex(
              (slot) => slot.id === b.deliverySelection?.slot,
            )
        : filters.sort === "oldest"
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt),
    );
}
export type AdminNavigate = (
  section: AdminSection,
  filters?: Partial<OrderFilters>,
  product?: Product,
) => void;
