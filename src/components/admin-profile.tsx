"use client";
import { useState } from "react";
import type { StoreSettings } from "@/lib/storefront";
export function ProfileFields({
  settings,
  onChange,
}: {
  settings: StoreSettings;
  onChange: (settings: StoreSettings) => void;
}) {
  const profile = settings.profile;
  const [lengths, setLengths] = useState(profile.nationalLengths.join(","));
  const [starts, setStarts] = useState(profile.nationalStarts.join(","));
  const patch = (value: Partial<typeof profile>) =>
    onChange({ ...settings, profile: { ...profile, ...value } });
  return (
    <section className="surface-card management-stack">
      <h2>Store identity & market</h2>
      <p>
        These settings control the storefront, checkout validation and dates.
        Currency changes do not convert catalog prices. Currency is locked after
        the first order to preserve reports. The included SSLCOMMERZ adapter
        accepts BDT / BD only.
      </p>
      <div className="form-grid">
        {(
          [
            ["name", "Store name"],
            ["tagline", "Tagline"],
            ["logoUrl", "Logo asset path / HTTPS URL"],
            ["supportEmail", "Support email"],
            ["supportPhone", "Support phone"],
            ["currency", "Currency (two-decimal ISO code)"],
            ["timeZone", "IANA time zone"],
            ["country", "Country (ISO two-letter code)"],
            ["city", "City"],
            ["postalCode", "Postal code"],
            ["callingCode", "Calling code (digits only)"],
            ["nationalPrefix", "National trunk prefix"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              value={profile[key]}
              maxLength={key === "logoUrl" ? 500 : 150}
              onChange={(e) => patch({ [key]: e.target.value })}
            />
          </label>
        ))}
        <label>
          National number lengths (comma-separated)
          <input
            value={lengths}
            onChange={(e) => (
              setLengths(e.target.value),
              patch({
                nationalLengths: e.target.value
                  .split(",")
                  .map((v) => Number(v.trim())),
              })
            )}
          />
        </label>
        <label>
          Allowed national starts (blank = any)
          <input
            value={starts}
            onChange={(e) => (
              setStarts(e.target.value),
              patch({
                nationalStarts: e.target.value
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
              })
            )}
          />
        </label>
      </div>
      <h3>Merchant policy content</h3>
      {(["terms", "privacy", "returns", "reservations"] as const).map((key) => (
        <label key={key}>
          {key}
          <textarea
            rows={3}
            minLength={10}
            maxLength={6000}
            value={profile.policies[key]}
            onChange={(e) =>
              patch({
                policies: { ...profile.policies, [key]: e.target.value },
              })
            }
          />
        </label>
      ))}
    </section>
  );
}
