"use client";
import { useLanguage } from "./language-provider";

import { useState, type FormEvent } from "react";
import { Check, MapPin } from "lucide-react";
import {
  deliveryAreas,
  type SavedAddress,
  type DeliveryArea,
} from "@/lib/orders";
import { Modal } from "./ui";
import { useShop } from "./shop-provider";
import { normalizePhone } from "@/lib/store-profile";

export function AddressForm({
  initial,
  area,
  onSave,
  onClose,
  orderOnly = false,
}: {
  initial?: SavedAddress;
  area: string;
  onSave: (address: SavedAddress) => Promise<void> | void;
  onClose: () => void;
  orderOnly?: boolean;
}) {
  const { t } = useLanguage();
  const { settings } = useShop();
  const deliveryAreas = settings.zones
    .filter((z) => z.enabled || z.name === initial?.area)
    .map((z) => z.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") || "").trim();
    const name = String(form.get("name") || "").trim();
    const address = String(form.get("address") || "").trim();
    if (
      name.length < 2 ||
      address.length < 10 ||
      !normalizePhone(phone, settings.profile)
    ) {
      setError(
        "Please enter a full name, valid store-country phone number and complete address.",
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSave({
        id: initial?.id || crypto.randomUUID(),
        label: (form.get("label") ||
          initial?.label ||
          "Home") as SavedAddress["label"],
        name,
        phone,
        address,
        area: form.get("area") as DeliveryArea,
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "We couldn’t save this address. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal
      title={initial ? "Edit delivery address" : "Add a delivery address"}
      onClose={() => {
        if (!loading) onClose();
      }}
      wide
    >
      <form className="checkout-form address-form" onSubmit={submit}>
        <p className="modal-description">
          <MapPin size={15} />
          {t("Fresh groceries, delivered to the right place.")}
        </p>
        <div className="form-grid">
          <label>
            {t("Full name")}
            <input
              name="name"
              autoComplete="name"
              defaultValue={initial?.name}
              placeholder={t("Your full name")}
              minLength={2}
              maxLength={80}
              required
            />
          </label>
          <label>
            {t("Mobile number")}
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={initial?.phone}
              placeholder={`+${settings.profile.callingCode}…`}
              maxLength={30}
              required
            />
          </label>
        </div>
        <div className="form-grid">
          {!orderOnly && (
            <label>
              {t("Address label")}
              <select name="label" defaultValue={initial?.label || "Home"}>
                <option value="Home">{t("Home")}</option>
                <option value="Office">{t("Office")}</option>
                <option value="Other">{t("Other")}</option>
              </select>
            </label>
          )}
          <label>
            {t("Delivery area")}
            <select name="area" defaultValue={initial?.area || area}>
              {deliveryAreas
                .filter(
                  (option) => !orderOnly || option === (initial?.area || area),
                )
                .map((option) => (
                  <option value={option} key={option}>
                    {t(option)}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label>
          {t("Street address")}
          <textarea
            name="address"
            autoComplete="street-address"
            defaultValue={initial?.address}
            placeholder={t("House, road, apartment and nearby landmark")}
            minLength={10}
            maxLength={300}
            rows={3}
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {t(error)}
          </p>
        )}
        <button type="submit" className="button primary" disabled={loading}>
          <Check size={18} />
          {t(loading ? "Saving address…" : "Save address")}
        </button>
        <small className="checkout-privacy">
          {t(
            orderOnly
              ? "These details update only this order’s delivery address."
              : "Addresses are saved to your account when signed in, or to this browser when shopping as a guest.",
          )}
        </small>
      </form>
    </Modal>
  );
}
