"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  formatOrderAmount,
  orderStatuses,
  ordersContentState,
  parseOrdersData,
  summarizeOrders,
  type OrderRecord,
  type OrdersData,
  type OrderStatus,
} from "../lib/orders";

type OrdersState =
  | { readonly kind: "empty"; readonly data: OrdersData }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "loading" }
  | { readonly kind: "success"; readonly data: OrdersData };

type OrderFilter = "All" | OrderStatus;

const filters: readonly OrderFilter[] = ["All", ...orderStatuses];

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M3 8h9M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <circle cx="8.5" cy="8.5" fill="none" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m13 13 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function OrdersHeading({ description }: Readonly<{ description: string }>) {
  return (
    <section className="orders-heading">
      <div>
        <p className="eyebrow">Fulfillment desk · Thursday, 20 August</p>
        <h1>Orders in motion.</h1>
        <p>{description}</p>
      </div>
      <div className="dispatch-callout">
        <span>Next carrier sweep</span>
        <strong>16:30 EDT</strong>
        <small>Dock 04 · East outbound</small>
      </div>
    </section>
  );
}

function LoadingOrders() {
  return (
    <main aria-busy="true" className="orders-page" data-orders-state="loading">
      <section className="orders-heading">
        <div><p className="eyebrow">Fulfillment desk</p><div className="skeleton skeleton--title" /></div>
        <div className="skeleton skeleton--dispatch" />
      </section>
      <section aria-label="Loading order summary" className="orders-summary is-loading">
        {Array.from({ length: 4 }, (_, index) => <div className="skeleton skeleton--summary" key={index} />)}
      </section>
      <section className="order-queue panel is-loading">
        <div className="skeleton skeleton--controls" />
        {Array.from({ length: 6 }, (_, index) => <div className="skeleton skeleton--row" key={index} />)}
      </section>
    </main>
  );
}

function EmptyOrders({ onRefresh }: Readonly<{ onRefresh: () => void }>) {
  return (
    <main className="orders-page" data-orders-state="empty">
      <OrdersHeading description="The fulfillment queue is ready for its next storefront update." />
      <section aria-labelledby="orders-empty-title" className="orders-empty panel">
        <div aria-hidden="true" className="orders-empty__visual">
          <span>00</span>
          <div><i /><i /><i /><i /></div>
        </div>
        <div>
          <p className="eyebrow">Queue cleared</p>
          <h2 id="orders-empty-title">No orders are waiting.</h2>
          <p>New orders will appear here as soon as a storefront sends them to Northline.</p>
          <button className="primary-action" onClick={onRefresh} type="button">Refresh queue <ArrowIcon /></button>
        </div>
      </section>
    </main>
  );
}

function ErrorOrders({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <main className="orders-page" data-orders-state="error">
      <OrdersHeading description="The fulfillment queue will resume when the commerce feed reconnects." />
      <section aria-labelledby="orders-error-title" className="orders-error panel">
        <div aria-hidden="true" className="orders-error__signal"><span>!</span><small>QUEUE OFFLINE</small></div>
        <div>
          <p className="eyebrow">Fulfillment feed interrupted</p>
          <h2 id="orders-error-title">The order queue did not arrive.</h2>
          <p>{message} No order data was changed. Retry the connection before the 16:30 carrier sweep.</p>
          <div className="error-actions">
            <button className="primary-action" onClick={onRetry} type="button">Retry queue <ArrowIcon /></button>
            <span>Incident NL-0820-B</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function statusClass(status: OrderStatus): string {
  return status.toLowerCase().replaceAll(" ", "-");
}

function OrdersTable({ orders }: Readonly<{ orders: readonly OrderRecord[] }>) {
  return (
    <div aria-label="Fulfillment order queue" className="order-queue-table" role="table">
      <div className="order-queue-row order-queue-row--head" role="row">
        <span role="columnheader">Order</span><span role="columnheader">Customer</span><span role="columnheader">Placed</span><span role="columnheader">Promise</span><span role="columnheader">Status</span><span role="columnheader">Total</span>
      </div>
      {orders.map((order) => (
        <div className="order-queue-row" key={order.id} role="row">
          <span data-label="Order" role="cell"><strong>{order.id}</strong><small>{order.channel} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}</small></span>
          <span data-label="Customer" role="cell"><strong>{order.customer}</strong><small>{order.region}</small></span>
          <span data-label="Placed" role="cell">{order.placedAt}</span>
          <span data-label="Promise" role="cell">{order.promise}</span>
          <span data-label="Status" role="cell"><i className={`order-status order-status--${statusClass(order.status)}`}>{order.status}</i></span>
          <span data-label="Total" role="cell">{formatOrderAmount(order.amountCents)}</span>
        </div>
      ))}
    </div>
  );
}

function SuccessOrders({ data }: Readonly<{ data: OrdersData }>) {
  const [controlsReady, setControlsReady] = useState(false);
  const [filter, setFilter] = useState<OrderFilter>("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialFilter = params.get("status");
    const initialQuery = params.get("q") ?? "";
    if (initialFilter !== null && filters.includes(initialFilter as OrderFilter)) setFilter(initialFilter as OrderFilter);
    setQuery(initialQuery);
    setControlsReady(true);
  }, []);

  useEffect(() => {
    if (!controlsReady) return;
    const url = new URL(window.location.href);
    if (filter === "All") url.searchParams.delete("status");
    else url.searchParams.set("status", filter);
    if (query.trim().length === 0) url.searchParams.delete("q");
    else url.searchParams.set("q", query.trim());
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [controlsReady, filter, query]);

  const visibleOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.orders.filter((order) => {
      const matchesFilter = filter === "All" || order.status === filter;
      const haystack = `${order.id} ${order.customer} ${order.region} ${order.channel}`.toLowerCase();
      return matchesFilter && (needle.length === 0 || haystack.includes(needle));
    });
  }, [data.orders, filter, query]);
  const summary = summarizeOrders(visibleOrders);

  const clearFilters = () => {
    setFilter("All");
    setQuery("");
  };

  return (
    <main className="orders-page" data-orders-state="success">
      <OrdersHeading description={`${data.orders.length} promises are moving through today’s warehouse and carrier windows.`} />
      <section aria-label="Order queue summary" className="orders-summary">
        <div><span>Open queue</span><strong>{summary.total}</strong><small>orders in view</small></div>
        <div><span>At risk</span><strong className="summary-risk">{summary.atRisk}</strong><small>need intervention</small></div>
        <div><span>Ready</span><strong>{summary.ready}</strong><small>waiting for sweep</small></div>
        <div><span>Queue value</span><strong>{formatOrderAmount(summary.valueCents)}</strong><small>before tax</small></div>
      </section>
      <section className="order-queue panel">
        <div className="order-queue__heading">
          <div><p className="eyebrow">Live queue</p><h2>Today’s fulfillment promises</h2></div>
          <span>{data.updatedAt}</span>
        </div>
        <div className="order-controls">
          <label className="order-search">
            <span className="sr-only">Search orders</span><SearchIcon />
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Search order, customer, or region" type="search" value={query} />
          </label>
          <div aria-label="Filter orders by status" className="order-filters" role="group">
            {filters.map((option) => (
              <button aria-pressed={filter === option} key={option} onClick={() => setFilter(option)} type="button">{option}</button>
            ))}
          </div>
        </div>
        <div aria-live="polite" className="queue-result-count">Showing {visibleOrders.length} of {data.orders.length} orders</div>
        {visibleOrders.length > 0 ? <OrdersTable orders={visibleOrders} /> : (
          <div className="orders-filter-empty">
            <p className="eyebrow">No matching promises</p><h3>No orders match this view.</h3>
            <p>Clear the search and status filter to return to the full fulfillment queue.</p>
            <button className="text-action" onClick={clearFilters} type="button">Clear filters <ArrowIcon /></button>
          </div>
        )}
      </section>
      <footer className="briefing-footer"><span>{summary.atRisk} orders need attention</span><span>Data source · Northline Commerce API</span></footer>
    </main>
  );
}

export function OrdersShell() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<OrdersState>({ kind: "loading" });
  const load = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    void fetch("/api/orders", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`The order service returned ${response.status}.`);
        const data = parseOrdersData(await response.json());
        setState({ data, kind: ordersContentState(data) });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "The order service could not be reached.",
        });
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <div aria-live="polite" className="state-frame">
      {state.kind === "loading" ? <LoadingOrders /> : null}
      {state.kind === "empty" ? <EmptyOrders onRefresh={load} /> : null}
      {state.kind === "error" ? <ErrorOrders message={state.message} onRetry={load} /> : null}
      {state.kind === "success" ? <SuccessOrders data={state.data} /> : null}
    </div>
  );
}
