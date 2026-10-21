"use client";
import Link from "next/link";
import { useState, useEffect, type FormEvent } from "react";
import {
  ArrowRight,
  Leaf,
  LockKeyhole,
  Mail,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAccount } from "./account-provider";
import { useShop } from "./shop-provider";
import { api } from "@/lib/client-api";
import { readAddresses, readReceipts } from "@/lib/order-browser";
import type { Account } from "@/lib/storefront";
import type { SavedAddress } from "@/lib/orders";
import { AddressForm } from "./address-form";
import { Breadcrumb } from "./ui";
export function AccountPage() {
  const {
    user,
    ready,
    error: sessionError,
    refresh,
    setUser,
    signOut,
  } = useAccount();
  const { items, notify, area } = useShop();
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(
      "login",
    ),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<SavedAddress | null | undefined>(
      undefined,
    ),
    [reset, setReset] = useState({ token: "", email: "" });
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const token = query.get("reset"),
      email = query.get("email");
    if (token && email) {
      setReset({ token, email });
      setMode("reset");
      window.history.replaceState({}, "", "/account");
    }
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || reset.email)
        .trim()
        .toLowerCase(),
      password = String(form.get("password") || ""),
      name = String(form.get("name") || "").trim();
    try {
      if (mode === "forgot") {
        const result = await api<{ message: string }>("/auth/forgot", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        setMessage(result.message);
        return;
      }
      if (mode === "reset") {
        await api("/auth/reset", {
          method: "POST",
          body: JSON.stringify({ email, token: reset.token, password }),
        });
        setMode("login");
        setMessage(
          "Your password has been updated. Sign in with your new password.",
        );
        return;
      }
      await api(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          ...(mode === "register" ? { name } : {}),
        }),
      });
      try {
        await api("/me/import", {
          method: "POST",
          body: JSON.stringify({
            addresses: readAddresses(),
            items,
            receipts: readReceipts().map(({ reference, accessToken }) => ({
              reference,
              accessToken,
            })),
          }),
        });
      } catch {
        notify(
          "Signed in. Some guest data could not be imported; please check your account.",
        );
      }
      await refresh();
      notify("Welcome to your FreshCart account.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile(addresses: SavedAddress[], name = user?.name) {
    if (!user) return;
    const result = await api<{ user: Account }>("/me", {
      method: "PATCH",
      body: JSON.stringify({ name, addresses }),
    });
    setUser(result.user);
    setEditing(undefined);
    notify("Account details saved.");
  }
  if (!ready)
    return (
      <div className="page-container loading-state">
        Opening your shopping space…
      </div>
    );
  return (
    <div className="page-container account-page">
      <Breadcrumb items={[{ label: "My account" }]} />
      {user ? (
        <>
          <div className="account-welcome">
            <div>
              <span className="eyebrow">YOUR EVERYDAY, A LITTLE EASIER</span>
              <h1>
                Hello, {user.name.split(" ")[0]}
                <span className="heading-dot">.</span>
              </h1>
              <p>{user.email}</p>
            </div>
            <button
              className="button outline"
              onClick={() => {
                void signOut().catch((e) => setError(e.message));
              }}
            >
              Sign out
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="account-dashboard">
            <section className="surface-card">
              <span className="round-icon">
                <UserRound />
              </span>
              <h2>Your profile</h2>
              <form
                className="enhance-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    await saveProfile(
                      user.addresses,
                      String(new FormData(e.currentTarget).get("name")),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Full name
                  <input
                    name="name"
                    defaultValue={user.name}
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </label>
                <label>
                  Email
                  <input value={user.email} disabled />
                </label>
                <button className="button primary" disabled={busy}>
                  Save profile
                </button>
              </form>
              <Link className="subtle-link" href="/orders">
                <Package size={17} /> View your orders <ArrowRight size={15} />
              </Link>
              <Link className="subtle-link" href="/lists">
                <Package size={17} /> My shopping lists <ArrowRight size={15} />
              </Link>
              {user.role === "admin" && (
                <Link className="subtle-link" href="/admin">
                  <ShieldCheck size={17} /> Open admin dashboard{" "}
                  <ArrowRight size={15} />
                </Link>
              )}
            </section>
            <section className="surface-card">
              <div className="card-title">
                <div>
                  <h2>Your delivery addresses</h2>
                  <p>Available whenever you sign in.</p>
                </div>
                <button
                  className="button outline"
                  disabled={user.addresses.length >= 8}
                  onClick={() => setEditing(null)}
                >
                  <Plus size={17} /> Add address
                </button>
              </div>
              {!user.addresses.length && (
                <div className="quiet-empty">
                  <MapPin /> Add your first delivery address.
                </div>
              )}
              <div className="account-addresses">
                {user.addresses.map((a) => (
                  <article key={a.id}>
                    <span className="round-icon">
                      <MapPin size={20} />
                    </span>
                    <div>
                      <strong>
                        {a.label} · {a.name}
                      </strong>
                      <p>{a.address}</p>
                      <small>
                        {a.area} · {a.phone}
                      </small>
                      <div className="inline-actions">
                        <button onClick={() => setEditing(a)}>Edit</button>
                        <button
                          aria-label={`Remove ${a.label} address`}
                          onClick={() => {
                            void saveProfile(
                              user.addresses.filter((v) => v.id !== a.id),
                            ).catch((e) => setError(e.message));
                          }}
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
          {editing !== undefined && (
            <AddressForm
              area={area}
              initial={editing || undefined}
              onClose={() => setEditing(undefined)}
              onSave={async (value) => {
                await saveProfile(
                  user.addresses.some((a) => a.id === value.id)
                    ? user.addresses.map((a) => (a.id === value.id ? value : a))
                    : [...user.addresses, value],
                );
              }}
            />
          )}
        </>
      ) : (
        <div className="auth-layout">
          <section className="auth-story">
            <span className="eyebrow">WELCOME TO YOUR FRESH SPACE</span>
            <h1>
              A little less effort.
              <br />
              <em>A lot more fresh.</em>
            </h1>
            <p>
              Your favourite groceries, delivery addresses and orders, together
              in one place.
            </p>
            <img
              src="/images/grocery-hero.png"
              alt="A basket of colourful fresh groceries"
            />
            <div>
              <Leaf size={20} /> Good food. Brighter days.
            </div>
          </section>
          <section className="auth-card">
            <span className="round-icon">
              <LockKeyhole size={26} />
            </span>
            <h2>
              {mode === "register"
                ? "Make yourself at home"
                : mode === "forgot"
                  ? "Forgot your password?"
                  : mode === "reset"
                    ? "Choose a new password"
                    : "Welcome back"}
            </h2>
            <p>
              {mode === "register"
                ? "Create your FreshCart account."
                : mode === "forgot"
                  ? "We’ll email you a secure reset link."
                  : mode === "reset"
                    ? "Use at least 10 characters."
                    : "Sign in for an easier everyday shop."}
            </p>
            {["login", "register"].includes(mode) && (
              <div className="auth-tabs">
                <button
                  className={mode === "login" ? "active" : ""}
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                >
                  Sign in
                </button>
                <button
                  className={mode === "register" ? "active" : ""}
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                >
                  Create account
                </button>
              </div>
            )}
            <form className="enhance-form" onSubmit={submit} key={mode}>
              {mode === "register" && (
                <label>
                  Full name
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
              )}
              {mode !== "reset" ? (
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                </label>
              ) : (
                <p>{reset.email}</p>
              )}
              {mode !== "forgot" && (
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    minLength={mode === "login" ? 1 : 10}
                    maxLength={128}
                  />
                </label>
              )}
              {(error || sessionError) && (
                <p className="form-error" role="alert">
                  {error || sessionError}
                </p>
              )}
              {message && (
                <p className="success-message" role="status">
                  {message}
                </p>
              )}
              <button className="button primary" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "register"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : mode === "reset"
                        ? "Update password"
                        : "Sign in"}
                <ArrowRight size={17} />
              </button>
            </form>
            {mode === "login" ? (
              <button
                className="text-button"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                }}
              >
                Forgot password?
              </button>
            ) : (
              mode !== "register" && (
                <button
                  className="text-button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setMessage("");
                  }}
                >
                  Back to sign in
                </button>
              )
            )}
            <p className="auth-privacy">
              <ShieldCheck size={15} /> Your account uses a secure, private
              session.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
