import { products } from "../catalog";
import { defaultContent } from "../management";
import { recipes } from "../recipes";
import { defaultSettings, type StoreSettings } from "../storefront";
import { demoCities, demoCity } from "./config";

// Fictional sample USD prices, deliberately assigned per SKU. These are neither
// currency conversions nor live market offers. Original BD seeds stay untouched.
const prices: Record<string, [number, number?]> = {
  banana: [2.99, 3.49],
  apple: [5.99, 6.99],
  tomato: [2.49],
  carrot: [1.99],
  broccoli: [3.49, 3.99],
  orange: [4.99],
  cucumber: [1.79],
  potato: [2.99],
  milk: [3.99, 4.49],
  bread: [3.49, 3.99],
  eggs: [2.99],
  oil: [6.49],
  "banana-500g": [1.69, 1.99],
  "apple-500g": [3.29, 3.79],
  "tomato-1kg": [4.49],
  "carrot-1kg": [3.49],
};
export const demoProducts = products.map((product) => {
  const price = prices[product.id];
  if (!price) throw new Error(`Missing demo USD price: ${product.id}`);
  return {
    ...structuredClone(product),
    price: price[0],
    originalPrice: price[1],
  };
});
export const demoRecipes = structuredClone(recipes);
export const demoContent = {
  ...structuredClone(defaultContent),
  showRegular: false,
  showActiveOrder: false,
};
export const demoSettings: StoreSettings = {
  ...structuredClone(defaultSettings),
  profile: {
    ...structuredClone(defaultSettings.profile),
    currency: "USD",
    country: "US",
    city: "New York",
    postalCode: "10001",
    timeZone: "America/New_York",
    callingCode: "1",
    nationalPrefix: "",
    nationalLengths: [10],
    nationalStarts: [],
    supportPhone: "",
    supportEmail: "",
    policies: {
      terms:
        "Demo only — no real payment or delivery. Prices and availability are fictional samples. Sales tax is not calculated; this is not a tax-compliant checkout.",
      privacy:
        "Use the supplied fictional customer. Demo orders stay in this browser only. No account, email or payment request is sent. Reset demo data removes this demo’s local data.",
      returns:
        "Returns, refunds and customer support requests are disabled in this interactive demo.",
      reservations:
        "Demo checkout does not reserve real inventory or arrange delivery.",
    },
  },
  zones: demoCities.map((city) => ({
    name: city.name,
    enabled: true,
    fee: city.fee,
    estimate: "Sample delivery schedule only.",
  })),
  freeDeliveryAt: 50,
  promos: [{ code: "FRESH10", percent: 10, maxDiscount: 5, active: true }],
  faqs: [
    {
      question: "Where do you deliver?",
      answer:
        "Preview New York, NY; Chicago, IL; and Los Angeles, CA. Demo only — no real payment or delivery.",
    },
    {
      question: "How is the delivery fee calculated?",
      answer:
        "Sample fees: New York $4.99, Chicago $3.99, Los Angeles $5.99. Free from $50 before discounts. FRESH10 takes 10% off, up to $5. Sales tax is not calculated.",
    },
    {
      question: "Do I need a real account?",
      answer:
        "No. Use the fictional customer at checkout. Login, email, payments and refunds are disabled.",
    },
  ],
};
export function demoSettingsFor(area: string): StoreSettings {
  const city = demoCity(area);
  return {
    ...demoSettings,
    profile: {
      ...demoSettings.profile,
      city: city.city,
      postalCode: city.zip,
      timeZone: city.timeZone,
    },
    slots: demoSettings.slots.map((slot) => ({
      ...slot,
      enabled: (city.slots as readonly string[]).includes(slot.id),
    })),
  };
}
export function demoCustomer(area: string) {
  const city = demoCity(area);
  return {
    name: "Alex Example",
    phone: "+1 (202) 555-0142",
    street: "123 Example Lane, Apt 4",
    city: city.city,
    state: city.state,
    zip: city.zip,
    country: "United States" as const,
    area: city.name,
  };
}
