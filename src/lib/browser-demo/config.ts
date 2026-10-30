// Direct NEXT_PUBLIC lookup is intentionally frozen into both server and client
// bundles by Next.js. Never derive this flag from a URL, cookie or storage.
export const BROWSER_DEMO = process.env.NEXT_PUBLIC_BROWSER_DEMO === "true";
export const DEMO_PREFIX = "freshcart-browser-demo:usa-usd:v1:";
export const demoKey = (key: string) => `${DEMO_PREFIX}${key}`;
export const demoCities = [
  {
    name: "New York, NY",
    city: "New York",
    state: "NY",
    zip: "10001",
    timeZone: "America/New_York",
    fee: 4.99,
    slots: ["morning", "afternoon", "evening"],
  },
  {
    name: "Chicago, IL",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    timeZone: "America/Chicago",
    fee: 3.99,
    slots: ["afternoon", "evening"],
  },
  {
    name: "Los Angeles, CA",
    city: "Los Angeles",
    state: "CA",
    zip: "90012",
    timeZone: "America/Los_Angeles",
    fee: 5.99,
    slots: ["morning", "evening"],
  },
] as const;
export function demoCity(area: string) {
  return demoCities.find((city) => city.name === area) || demoCities[0];
}
