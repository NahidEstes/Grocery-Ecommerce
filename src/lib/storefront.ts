import type { Product } from "./catalog";
import type { SavedAddress } from "./orders";
export type SupportTicket = {
  id: string;
  reference: string;
  name: string;
  message: string;
  status: "open" | "resolved";
  createdAt: string;
};
export type Account = {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
  addresses: SavedAddress[];
  createdAt: string;
};
export type Bundle = {
  id: string;
  name: string;
  description: string;
  items: { productId: string; quantity: number }[];
  active: boolean;
};
export type StoreSettings = {
  categories: { slug: string; name: string; atlas: number }[];
  zones: { name: string; enabled: boolean; fee: number; estimate: string }[];
  slots: { id: "morning" | "afternoon" | "evening"; enabled: boolean }[];
  freeDeliveryAt: number;
  promos: {
    code: string;
    percent: number;
    maxDiscount: number;
    active: boolean;
  }[];
  bundles: Bundle[];
  faqs: { question: string; answer: string }[];
  homeSections: {
    seasonal: boolean;
    arrivals: boolean;
    popular: boolean;
    bundles: boolean;
    reviews: boolean;
  };
};
export type Review = {
  id: string;
  userId: string;
  author: string;
  productId: string;
  reference: string;
  rating: number;
  text: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};
export const defaultSettings: StoreSettings = {
  categories: [
    { slug: "fruits", name: "Fresh fruits", atlas: 1 },
    { slug: "vegetables", name: "Vegetables", atlas: 4 },
    { slug: "dairy", name: "Dairy & eggs", atlas: 8 },
    { slug: "bakery", name: "Bakery", atlas: 9 },
    { slug: "pantry", name: "Pantry essentials", atlas: 11 },
  ],
  zones: ["Dhanmondi", "Mirpur", "Uttara", "Gulshan"].map((name) => ({
    name,
    enabled: true,
    fee: 40,
    estimate: "Choose an available slot at checkout",
  })),
  slots: [
    { id: "morning", enabled: true },
    { id: "afternoon", enabled: true },
    { id: "evening", enabled: true },
  ],
  freeDeliveryAt: 1000,
  promos: [{ code: "FRESH10", percent: 10, maxDiscount: 100, active: true }],
  bundles: [
    {
      id: "breakfast",
      name: "A brighter breakfast",
      description: "Bread, milk, eggs and bananas for your morning table.",
      active: true,
      items: [
        { productId: "bread", quantity: 1 },
        { productId: "milk", quantity: 1 },
        { productId: "eggs", quantity: 1 },
        { productId: "banana", quantity: 1 },
      ],
    },
    {
      id: "weekly",
      name: "Your weekly fresh basket",
      description: "Everyday produce, ready for the week ahead.",
      active: true,
      items: [
        { productId: "potato", quantity: 2 },
        { productId: "tomato", quantity: 2 },
        { productId: "carrot", quantity: 1 },
        { productId: "cucumber", quantity: 1 },
      ],
    },
    {
      id: "family",
      name: "Family pantry top-up",
      description: "A bigger basket of everyday kitchen essentials.",
      active: true,
      items: [
        { productId: "oil", quantity: 2 },
        { productId: "eggs", quantity: 2 },
        { productId: "potato", quantity: 3 },
        { productId: "milk", quantity: 2 },
      ],
    },
  ],
  faqs: [
    {
      question: "Where do you deliver?",
      answer:
        "Select your area in the delivery checker to see coverage and charges. Available dates and times are shown at checkout, in Dhaka time.",
    },
    {
      question: "How is the delivery fee calculated?",
      answer:
        "Your area’s delivery fee applies below the free-delivery threshold. The exact fee and total are shown before you place an order.",
    },
    {
      question: "What if an item arrives damaged?",
      answer:
        "Keep the packaging and order number, and report the issue through the Help option on your order page. The store will review the issue before confirming any replacement or refund.",
    },
    {
      question: "How do returns and refunds work?",
      answer:
        "Report an issue promptly through your order’s Help option. Eligibility depends on the item and its condition. No automatic refund is promised; the store must confirm the resolution.",
    },
  ],
  homeSections: {
    seasonal: true,
    arrivals: true,
    popular: true,
    bundles: true,
    reviews: true,
  },
};
export function unitPrice(product: Product) {
  if (!product.measure || !product.measureUnit) return "";
  return `৳ ${Number((product.price / product.measure).toFixed(2)).toLocaleString("en-BD")} / ${product.measureUnit}`;
}
