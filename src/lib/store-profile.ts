export type StoreProfile = {
  name: string;
  tagline: string;
  logoUrl: string;
  supportEmail: string;
  supportPhone: string;
  currency: string;
  timeZone: string;
  country: string;
  city: string;
  postalCode: string;
  callingCode: string;
  nationalPrefix: string;
  nationalLengths: number[];
  nationalStarts: string[];
  policies: {
    terms: string;
    privacy: string;
    returns: string;
    reservations: string;
  };
};
export const defaultProfile: StoreProfile = {
  name: "FreshCart",
  tagline: "Good food. Brighter days.",
  logoUrl: "/icon.svg",
  supportEmail: "",
  supportPhone: "",
  currency: "BDT",
  timeZone: "Asia/Dhaka",
  country: "BD",
  city: "Dhaka",
  postalCode: "1200",
  callingCode: "880",
  nationalPrefix: "0",
  nationalLengths: [10],
  nationalStarts: ["13", "14", "15", "16", "17", "18", "19"],
  policies: {
    terms:
      "Delivery charges, availability and the final total are confirmed at checkout. Contact the store for help with an order.",
    privacy:
      "We use account, address and order information to fulfil your purchases. Sign out on shared devices.",
    returns:
      "Report missing or damaged items promptly. The store reviews eligibility before approving a return or externally completed refund.",
    reservations:
      "Unpaid online reservations expire after 30 minutes. COD orders are reviewed manually; age alone does not cancel a valid COD order. Customers may have up to three outstanding COD orders by default.",
  },
};
export function normalizePhone(
  value: string,
  profile: StoreProfile = defaultProfile,
): string {
  let digits = value.replace(/[\s().-]/g, "");
  if (digits.startsWith("+")) {
    if (!digits.startsWith(`+${profile.callingCode}`)) return "";
    digits = digits.slice(profile.callingCode.length + 1);
  } else if (
    digits.startsWith(profile.callingCode) &&
    digits.length > Math.max(...profile.nationalLengths)
  )
    digits = digits.slice(profile.callingCode.length);
  if (profile.nationalPrefix && digits.startsWith(profile.nationalPrefix))
    digits = digits.slice(profile.nationalPrefix.length);
  if (
    !/^\d+$/.test(digits) ||
    !profile.nationalLengths.includes(digits.length) ||
    (profile.nationalStarts.length &&
      !profile.nationalStarts.some((p) => digits.startsWith(p)))
  )
    return "";
  return `+${profile.callingCode}${digits}`;
}
export function profileFor(value?: Partial<StoreProfile>): StoreProfile {
  return {
    ...defaultProfile,
    ...value,
    policies: { ...defaultProfile.policies, ...value?.policies },
  };
}
export function currencyText(
  value: number,
  currency = defaultProfile.currency,
) {
  return currency === "BDT"
    ? `৳ ${value.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`
    : new Intl.NumberFormat(currency === "USD" ? "en-US" : "en", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
}
export function zonedDate(
  now = new Date(),
  timeZone = defaultProfile.timeZone,
) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
