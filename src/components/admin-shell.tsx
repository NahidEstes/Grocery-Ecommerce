"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Leaf,
  Menu,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  Truck,
  Undo2,
  X,
  Languages,
} from "lucide-react";
import {
  allowedAdminTools,
  type AdminSection,
  type StaffAccountRole,
} from "@/lib/admin-workspace";

const icons = {
  overview: LayoutDashboard,
  orders: Package,
  inventory: Truck,
  returns: Undo2,
  products: Boxes,
  content: LayoutDashboard,
  recipes: Leaf,
  languages: Languages,
  search: Search,
  reviews: Star,
  support: MessageSquare,
  settings: Settings2,
  team: ShieldCheck,
  activity: Check,
};
export function AdminDrawer({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current!,
      focused = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      focused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`workspace-drawer ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close.current();
      }}
    >
      <div className="workspace-drawer-content">
        <header>
          <div>
            <span className="eyebrow">STORE MANAGER</span>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="workspace-icon"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function AdminShell({
  active,
  role,
  name,
  storeName,
  busy,
  onRefresh,
  onNavigate,
  taskCount,
  children,
}: {
  active: AdminSection;
  role: StaffAccountRole;
  name: string;
  storeName: string;
  busy: boolean;
  onRefresh: () => void;
  onNavigate: (section: AdminSection) => void;
  taskCount: number;
  children: ReactNode;
}) {
  const [compact, setCompact] = useState(false),
    [mobile, setMobile] = useState(false),
    [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([
    "Content",
    "Business & settings",
  ]);
  const tools = allowedAdminTools(role),
    current = tools.find((tool) => tool.id === active);
  function nav(mobileMode: boolean) {
    return (
      <>
        <Link href="/admin" className="workspace-brand">
          <span>
            <Leaf size={25} />
          </span>
          <div>
            {storeName}
            <small>STORE MANAGER</small>
          </div>
        </Link>
        {(!compact || mobileMode) && (
          <label className="workspace-menu-search">
            <Search size={16} />
            <input
              aria-label="Search administration menu"
              placeholder="Find a tool…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}
        <nav aria-label="Administration">
          {[...new Set(tools.map((tool) => tool.group))].map((group) => {
            const matches = tools.filter(
              (tool) =>
                tool.group === group &&
                `${tool.label} ${tool.group}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            );
            if (!matches.length) return null;
            const open =
              !!query ||
              !collapsed.includes(group) ||
              matches.some((tool) => tool.id === active) ||
              (compact && !mobileMode);
            return (
              <section className="workspace-nav-group" key={group}>
                {group !== "Workspace" && (!compact || mobileMode) && (
                  <button
                    className="workspace-group-toggle"
                    aria-expanded={open}
                    onClick={() =>
                      setCollapsed((previous) =>
                        previous.includes(group)
                          ? previous.filter((item) => item !== group)
                          : [...previous, group],
                      )
                    }
                  >
                    {group}
                    <ChevronDown
                      size={13}
                      className={open ? "" : "is-closed"}
                    />
                  </button>
                )}
                {open &&
                  matches.map((tool) => {
                    const Icon = icons[tool.icon];
                    return (
                      <button
                        type="button"
                        key={tool.id}
                        className={`workspace-nav-item ${active === tool.id ? "active" : ""}`}
                        aria-current={active === tool.id ? "page" : undefined}
                        aria-label={tool.label}
                        title={tool.label}
                        onClick={() => {
                          onNavigate(tool.id);
                          setMobile(false);
                        }}
                      >
                        <Icon size={19} />
                        <span>{tool.label}</span>
                        {active === tool.id && <i />}
                      </button>
                    );
                  })}
              </section>
            );
          })}
          {!tools.some((tool) =>
            `${tool.label} ${tool.group}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          ) && <p className="workspace-nav-empty">No matching tools.</p>}
        </nav>
        <div className="workspace-side-footer">
          <span className="workspace-avatar">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{name}</strong>
            <small>{role}</small>
          </div>
          <Link
            href="/account"
            aria-label="Manage your account"
            title="Manage account"
          >
            <ChevronRight size={17} />
          </Link>
        </div>
      </>
    );
  }
  return (
    <div className={`workspace-shell ${compact ? "is-compact" : ""}`}>
      <aside className="workspace-sidebar">
        {nav(false)}
        <button
          className="workspace-collapse"
          onClick={() => setCompact(!compact)}
          aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
        >
          {compact ? (
            <PanelLeftOpen size={18} />
          ) : (
            <>
              <PanelLeftClose size={18} />
              <span>Collapse sidebar</span>
            </>
          )}
        </button>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <button
            className="workspace-icon workspace-mobile-menu"
            aria-label="Open admin navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={22} />
          </button>
          <div className="workspace-breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>{current?.label}</strong>
          </div>
          <div className="workspace-top-actions">
            {tools.some((tool) => tool.id === "overview") && (
              <button
                className="workspace-tasks-link"
                onClick={() => onNavigate("overview")}
                aria-label={`View work queue, ${taskCount} open orders and stock alerts`}
              >
                <Check size={16} />
                <span>Work queue</span>
                <b>{taskCount}</b>
              </button>
            )}
            <button
              className="workspace-icon"
              onClick={onRefresh}
              disabled={busy}
              aria-label="Refresh workspace"
            >
              <RefreshCw
                size={17}
                className={busy ? "workspace-spinning" : ""}
              />
            </button>
            <Link href="/" className="workspace-store-link">
              View storefront <ArrowUpRight size={15} />
            </Link>
            <Link
              href="/account"
              className="workspace-avatar"
              aria-label="Your account"
            >
              {name.slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </header>
        <section className="admin-content workspace-content">
          {children}
        </section>
      </div>
      {mobile && (
        <AdminDrawer
          title="Administration"
          className="workspace-mobile-drawer"
          onClose={() => setMobile(false)}
        >
          {nav(true)}
        </AdminDrawer>
      )}
    </div>
  );
}
