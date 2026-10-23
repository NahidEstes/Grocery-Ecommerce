import type { Account } from "./storefront";
import type { Order } from "./orders";
export const staffRoles = ["admin", "manager", "editor", "fulfilment"] as const;
export type StaffRole = (typeof staffRoles)[number];
export type Permission =
  | "reports"
  | "products"
  | "content"
  | "orders"
  | "support"
  | "reviews"
  | "returns"
  | "team"
  | "audit";
const grants: Record<string, Permission[]> = {
  admin: [
    "reports",
    "products",
    "content",
    "orders",
    "support",
    "reviews",
    "returns",
    "team",
    "audit",
  ],
  manager: [
    "reports",
    "products",
    "content",
    "orders",
    "support",
    "reviews",
    "returns",
    "audit",
  ],
  editor: ["products", "content", "reviews"],
  fulfilment: ["orders", "support"],
};
export const can = (
  role: Account["role"] | undefined,
  permission: Permission,
) => !!role && !!grants[role]?.includes(permission);
export const isStaff = (role: Account["role"] | undefined) =>
  !!role && !!grants[role];
export const homeSectionIds = [
  "categories",
  "coverage",
  "bundles",
  "recipes",
  "seasonal",
  "arrivals",
  "popular",
  "reviews",
  "faq",
] as const;
export type HomeSectionId = (typeof homeSectionIds)[number];
export type SearchAlias = { term: string; productIds: string[] };
export type ContentConfig = {
  version: number;
  hero: {
    eyebrow: string;
    title: string;
    highlight: string;
    description: string;
    button: string;
    href: string;
    imageUrl: string;
  };
  banners: {
    title: string;
    eyebrow: string;
    description: string;
    button: string;
    href: string;
    imageUrl: string;
  }[];
  showRegular: boolean;
  showActiveOrder: boolean;
  showDeals: boolean;
  dealsTitle: string;
  sections: { id: HomeSectionId; enabled: boolean; title: string }[];
  aliases: SearchAlias[];
  lowStockThreshold: number;
};
export const defaultContent: ContentConfig = {
  version: 0,
  hero: {
    eyebrow: "FRESHER DAYS AHEAD",
    title: "Your daily essentials,",
    highlight: "delivered.",
    description:
      "Fresh produce, pantry staples, household essentials and more — all at your doorstep.",
    button: "Start shopping",
    href: "/products",
    imageUrl: "/images/grocery-hero.png",
  },
  banners: [
    {
      eyebrow: "EAT HEALTHY EVERYDAY",
      title: "Fresh Fruits & Vegetables",
      description: "Farm-fresh goodness for a healthier you.",
      button: "Shop fresh produce",
      href: "/products?category=produce",
      imageUrl: "",
    },
    {
      eyebrow: "STOCK UP & SAVE",
      title: "Pantry Essentials",
      description: "Everyday staples at great prices.",
      button: "Shop pantry",
      href: "/products?category=pantry",
      imageUrl: "",
    },
  ],
  showRegular: true,
  showActiveOrder: true,
  showDeals: true,
  dealsTitle: "Today’s best deals",
  sections: homeSectionIds.map((id) => ({
    id,
    enabled: true,
    title: {
      categories: "A fresh start in every aisle",
      coverage: "Do we deliver to your door?",
      bundles: "Good things come together",
      recipes: "A little inspiration for your table",
      seasonal: "In season, full of goodness",
      arrivals: "Meet the new arrivals",
      popular: "Your neighbourhood favourites",
      reviews: "From our customers’ kitchens",
      faq: "Good questions. Fresh answers.",
    }[id],
  })),
  aliases: [],
  lowStockThreshold: 5,
};
export type AuditEvent = {
  id: string;
  at: string;
  actorId: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
};
export type StockEvent = AuditEvent & {
  productId: string;
  before: number;
  after: number;
  reason: string;
};
export type OrderOperations = {
  reference: string;
  version: number;
  notes: { id: string; text: string; actor: string; at: string }[];
};
export type CaseMeta = {
  id: string;
  version: number;
  assigneeId: string;
  priority: "low" | "normal" | "high";
  updatedAt: string;
  resolvedAt?: string;
};
export type ReturnRequest = {
  id: string;
  reference: string;
  userId?: string;
  name: string;
  reason: string;
  items: { productId: string; quantity: number }[];
  amount: number;
  status:
    | "requested"
    | "approved"
    | "received"
    | "refund-pending"
    | "refunded"
    | "rejected";
  version: number;
  createdAt: string;
  updatedAt: string;
  restocked: boolean;
  refundMethod?: string;
  refundReference?: string;
  notes: string;
  history: { status: string; at: string; actor: string }[];
};
export type SalesReport = {
  periodDays: number;
  mode: "live" | "demo";
  current: {
    orders: number;
    delivered: number;
    revenue: number;
    discount: number;
  };
  previous: {
    orders: number;
    delivered: number;
    revenue: number;
    discount: number;
  };
  daily: { date: string; revenue: number; orders: number }[];
  promos: {
    code: string;
    uses: number;
    completed: number;
    discount: number;
    revenue: number;
  }[];
};
export function salesReport(
  orders: Order[],
  days: number,
  mode: "live" | "demo",
  now = new Date(),
): SalesReport {
  const dayKey = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  const today = dayKey(now),
    end = Date.parse(`${today}T00:00:00+06:00`) + 86400000,
    start = end - days * 86400000,
    previousStart = start - days * 86400000;
  const eligible = orders.filter((o) =>
    mode === "live"
      ? o.mode === "mongodb" && !o.sandbox
      : o.mode === "demo" || o.sandbox,
  );
  const current = eligible.filter(
      (o) => Date.parse(o.createdAt) >= start && Date.parse(o.createdAt) < end,
    ),
    previous = eligible.filter(
      (o) =>
        Date.parse(o.createdAt) >= previousStart &&
        Date.parse(o.createdAt) < start,
    );
  const paid = (o: Order) =>
    o.status === "delivered" &&
    (o.payment === "cash-on-delivery" || o.paymentStatus === "paid");
  const sum = (list: Order[]) => ({
    orders: list.length,
    delivered: list.filter(paid).length,
    revenue:
      Math.round(list.filter(paid).reduce((n, o) => n + o.total, 0) * 100) /
      100,
    discount:
      Math.round(list.filter(paid).reduce((n, o) => n + o.discount, 0) * 100) /
      100,
  });
  const daily = Array.from({ length: days }, (_, i) => ({
    date: dayKey(new Date(start + i * 86400000)),
    revenue: 0,
    orders: 0,
  }));
  for (const o of current) {
    const d = daily.find((d) => d.date === dayKey(new Date(o.createdAt)));
    if (d) {
      d.orders++;
      if (paid(o)) d.revenue = Math.round((d.revenue + o.total) * 100) / 100;
    }
  }
  const promos = new Map<
    string,
    {
      code: string;
      uses: number;
      completed: number;
      discount: number;
      revenue: number;
    }
  >();
  for (const o of current.filter((o) => o.status !== "cancelled")) {
    if (!o.promoCode) continue;
    const p = promos.get(o.promoCode) || {
      code: o.promoCode,
      uses: 0,
      completed: 0,
      discount: 0,
      revenue: 0,
    };
    p.uses++;
    if (paid(o)) {
      p.completed++;
      p.discount = Math.round((p.discount + o.discount) * 100) / 100;
      p.revenue = Math.round((p.revenue + o.total) * 100) / 100;
    }
    promos.set(p.code, p);
  }
  return {
    periodDays: days,
    mode,
    current: sum(current),
    previous: sum(previous),
    daily,
    promos: [...promos.values()],
  };
}
