"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  Check,
  Clock3,
  Leaf,
  MessageSquare,
  Package,
  Plus,
  ShoppingBag,
  Star,
  Undo2,
  Wallet,
} from "lucide-react";
import { can, type ReturnRequest } from "@/lib/management";
import type { InventoryBatch } from "@/lib/inventory";
import { isExpired } from "@/lib/inventory";
import { api } from "@/lib/client-api";
import {
  isOpenOrder,
  adminCalendarDate,
  orderStatusLabel,
  type AdminOverviewData,
  type AdminNavigate,
  type StaffAccountRole,
} from "@/lib/admin-workspace";
import { ProductImage } from "./ui";
import { useStoreFormat } from "./store-format";

export function AdminOverview({
  data,
  role,
  name,
  navigate,
  revision,
}: {
  data: AdminOverviewData;
  role: StaffAccountRole;
  name: string;
  navigate: AdminNavigate;
  revision: number;
}) {
  const { money, orderTime } = useStoreFormat();
  const today = adminCalendarDate(new Date(), data.settings.profile.timeZone);
  const [extra, setExtra] = useState<{
    returns?: ReturnRequest[];
    batches?: InventoryBatch[];
    failed: string[];
  }>({ failed: [] });
  useEffect(() => {
    const controller = new AbortController();
    setExtra({ failed: [] });
    const requests: { name: string; run: Promise<unknown> }[] = [];
    if (can(role, "returns"))
      requests.push({
        name: "Returns",
        run: api<{ returns: ReturnRequest[] }>("/admin/returns", {
          signal: controller.signal,
        }),
      });
    if (can(role, "purchasing"))
      requests.push({
        name: "Batch alerts",
        run: api<{ batches: InventoryBatch[] }>("/admin/purchasing", {
          signal: controller.signal,
        }),
      });
    void Promise.allSettled(requests.map((request) => request.run)).then(
      (results) => {
        if (controller.signal.aborted) return;
        const snapshot: typeof extra = { failed: [] };
        results.forEach((result, index) => {
          if (result.status === "rejected")
            snapshot.failed.push(requests[index].name);
          else if (requests[index].name === "Returns")
            snapshot.returns = (
              result.value as { returns: ReturnRequest[] }
            ).returns;
          else
            snapshot.batches = (
              result.value as { batches: InventoryBatch[] }
            ).batches;
        });
        setExtra(snapshot);
      },
    );
    return () => controller.abort();
  }, [role, revision]);
  const lowStock = data.products.filter(
    (product) =>
      product.active !== false &&
      product.stock <= (product.lowStockThreshold ?? data.stockThreshold),
  );
  const newOrders = data.orders.filter((order) => order.status === "placed");
  const due = data.orders.filter(
    (order) => isOpenOrder(order) && order.deliverySelection?.date === today,
  );
  const week = new Date(`${today}T12:00:00Z`);
  week.setUTCDate(week.getUTCDate() + 7);
  const expiry = extra.batches?.filter(
    (batch) =>
      batch.remaining > 0 &&
      batch.expiresOn &&
      batch.expiresOn <= week.toISOString().slice(0, 10),
  );
  const waitingReturns = extra.returns?.filter((request) =>
    ["requested", "approved", "received", "refund-pending"].includes(
      request.status,
    ),
  );
  const queue = [
    ...(can(role, "orders")
      ? [
          {
            title: "New orders",
            count: newOrders.length,
            description: "Review and start preparing",
            icon: ShoppingBag,
            tone: "orange",
            go: () => navigate("orders", { status: "placed" }),
          },
          {
            title: "Due for delivery today",
            count: due.length,
            description: `Scheduled in ${data.settings.profile.timeZone}`,
            icon: CalendarDays,
            tone: "green",
            go: () =>
              navigate("orders", { deliveryDate: today, status: "open" }),
          },
        ]
      : []),
    ...(can(role, "products")
      ? [
          {
            title: "Low-stock products",
            count: lowStock.length,
            description: "Check stock before the next rush",
            icon: Boxes,
            tone: "amber",
            go: () => navigate("inventory"),
          },
        ]
      : []),
    ...(can(role, "returns")
      ? [
          {
            title: "Returns to follow up",
            count: waitingReturns?.length,
            description: "Review, receive or reconcile",
            icon: Undo2,
            tone: "purple",
            go: () => navigate("returns"),
          },
        ]
      : []),
    ...(can(role, "purchasing")
      ? [
          {
            title: "Batch expiry alerts",
            count: expiry?.length,
            description: "Expired or expiring within 7 days",
            icon: Clock3,
            tone: "rose",
            go: () => navigate("purchasing"),
          },
        ]
      : []),
  ];
  return (
    <div className="workspace-overview">
      <div className="workspace-welcome">
        <div>
          <span className="eyebrow">A FRESH START TO YOUR WORKDAY</span>
          <h1>
            Hello, {name.split(" ")[0]}. <span>Let’s keep things moving.</span>
          </h1>
          <p>Your orders, stock and next steps, all in one place.</p>
        </div>
        <div className="workspace-today">
          <CalendarDays size={18} />
          <span>
            {new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
            <small>{data.settings.profile.timeZone}</small>
          </span>
        </div>
      </div>
      <div className="workspace-metrics">
        {[
          {
            label: "All orders",
            value: data.metrics.orders.toLocaleString("en"),
            note: "Across all dates",
            icon: ShoppingBag,
            go: () => navigate("orders"),
          },
          {
            label: "Awaiting fulfilment",
            value: data.metrics.pending,
            note: "Orders still in progress",
            icon: Package,
            go: () => navigate("orders", { status: "open" }),
          },
          {
            label: "Delivered sales",
            value: money(data.metrics.revenue),
            note: "All time · before refunds",
            icon: Wallet,
            go: () => navigate("reports"),
          },
          {
            label: "Low-stock products",
            value: lowStock.length,
            note: "Active products below their threshold",
            icon: Boxes,
            go: () => navigate("inventory"),
          },
        ].map((metric) => (
          <button
            className="workspace-metric"
            key={metric.label}
            onClick={metric.go}
          >
            <div>
              <span>{metric.label}</span>
              <metric.icon size={19} />
            </div>
            <strong>{metric.value}</strong>
            <small>
              {metric.note}
              <ArrowUpRight size={14} />
            </small>
          </button>
        ))}
      </div>
      <p className="workspace-metric-note">
        Delivered sales exclude demo and sandbox orders. This is not settlement
        or profit.
      </p>
      <section className="workspace-panel workspace-queue">
        <div className="workspace-section-heading">
          <div>
            <span className="eyebrow">YOUR NEXT STEPS</span>
            <h2>What needs attention</h2>
          </div>
          <span className="workspace-subtle">Click a task to get started</span>
        </div>
        <div className="workspace-task-grid">
          {queue.map((task) => (
            <button
              className="workspace-task"
              key={task.title}
              onClick={task.go}
            >
              <span className={`workspace-task-icon ${task.tone}`}>
                <task.icon size={20} />
              </span>
              <strong>{task.count ?? "—"}</strong>
              <h3>{task.title}</h3>
              <p>
                {task.count === undefined
                  ? "Loading, or unavailable. Use Refresh to retry."
                  : task.description}
              </p>
              <ArrowUpRight size={16} className="workspace-task-arrow" />
            </button>
          ))}
        </div>
        {!!extra.failed.length && (
          <p className="workspace-inline-error" role="status">
            {extra.failed.join(" and ")} could not be loaded. Refresh the
            workspace to retry; these counts are not zero.
          </p>
        )}
      </section>
      <div className="workspace-overview-columns">
        <section className="workspace-panel">
          <div className="workspace-section-heading">
            <div>
              <h2>Latest orders</h2>
              <p>A quick look at what’s coming in.</p>
            </div>
            <button
              className="workspace-text-button"
              onClick={() => navigate("orders")}
            >
              View orders <ArrowRight size={15} />
            </button>
          </div>
          <div className="workspace-recent-orders">
            {[...data.orders]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 5)
              .map((order) => (
                <button
                  key={order.reference}
                  onClick={() => navigate("orders", { query: order.reference })}
                >
                  <span className="workspace-order-symbol">
                    <ShoppingBag size={18} />
                  </span>
                  <span className="workspace-recent-name">
                    <strong>{order.customer.name}</strong>
                    <small>
                      {order.reference} ·{" "}
                      {orderTime(
                        order.createdAt,
                        "en",
                        order.timeZone || data.settings.profile.timeZone,
                      )}
                    </small>
                  </span>
                  <span className={`workspace-status ${order.status}`}>
                    {orderStatusLabel(order.status)}
                  </span>
                  <b>
                    {money(
                      order.total,
                      order.currency || data.settings.profile.currency,
                    )}
                  </b>
                  <ChevronIcon />
                </button>
              ))}
            {!data.orders.length && (
              <div className="workspace-empty">
                <ShoppingBag size={27} />
                <h3>Your next order starts here</h3>
                <p>New orders will appear as customers check out.</p>
              </div>
            )}
          </div>
        </section>
        <section className="workspace-panel">
          <div className="workspace-section-heading">
            <div>
              <h2>Stock watch</h2>
              <p>A little attention keeps shelves ready.</p>
            </div>
            <span className="workspace-count">{lowStock.length}</span>
          </div>
          <div className="workspace-stock-watch">
            {lowStock.slice(0, 4).map((product) => (
              <button
                key={product.id}
                onClick={() => navigate("products", undefined, product)}
              >
                <ProductImage product={product} />
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.unit}</small>
                </span>
                <b>{product.stock} left</b>
              </button>
            ))}
            {!lowStock.length && (
              <div className="workspace-empty">
                <span className="workspace-healthy">
                  <Check size={24} />
                </span>
                <h3>Shelves are looking good</h3>
                <p>
                  All active products are above their stock alert threshold.
                </p>
              </div>
            )}
          </div>
          {!!lowStock.length && (
            <button
              className="workspace-text-button"
              onClick={() => navigate("inventory")}
            >
              Review stock alerts <ArrowRight size={15} />
            </button>
          )}
        </section>
      </div>
      <section className="workspace-panel workspace-shortcuts">
        <div>
          <span className="workspace-task-icon green">
            <Leaf size={22} />
          </span>
          <div>
            <h2>A well-run store, one step at a time.</h2>
            <p>Pick up where your customers need you.</p>
          </div>
        </div>
        <div>
          {can(role, "products") && (
            <button
              className="button outline"
              onClick={() => navigate("products")}
            >
              <Plus size={16} />
              Manage products
            </button>
          )}
          {can(role, "support") && (
            <button
              className="button outline"
              onClick={() => navigate("support")}
            >
              <MessageSquare size={16} />
              Support{" "}
              <span className="workspace-count">
                {
                  data.support.filter((ticket) => ticket.status === "open")
                    .length
                }
              </span>
            </button>
          )}
          {can(role, "reviews") && (
            <button
              className="button outline"
              onClick={() => navigate("reviews")}
            >
              <Star size={16} />
              Reviews{" "}
              <span className="workspace-count">
                {
                  data.reviews.filter((review) => review.status === "pending")
                    .length
                }
              </span>
            </button>
          )}
        </div>
      </section>
      {!!expiry?.length && (
        <p className="workspace-subtle">
          Batch watch includes{" "}
          {expiry.filter((batch) => isExpired(batch, today)).length} already
          expired batches. Inspect physical stock in Suppliers & batches before
          taking action.
        </p>
      )}
    </div>
  );
}
function ChevronIcon() {
  return <ArrowUpRight size={15} className="workspace-recent-arrow" />;
}
