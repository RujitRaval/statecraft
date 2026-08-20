"use client";

import { useCallback, useEffect, useState } from "react";

import {
  dashboardContentState,
  parseDashboardData,
  type DashboardData,
  type DashboardOrder,
} from "../lib/dashboard";

type DashboardState =
  | { readonly kind: "empty"; readonly data: DashboardData }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "loading" }
  | { readonly kind: "success"; readonly data: DashboardData };

const navItems = [
  { current: true, label: "Overview", mark: "01" },
  { current: false, label: "Orders", mark: "02" },
  { current: false, label: "Customers", mark: "03" },
] as const;

function BrandMark() {
  return (
    <svg aria-hidden="true" className="brand-mark" viewBox="0 0 32 32">
      <path d="M4 4h9v9H4zM19 4h9v9h-9zM4 19h9v9H4z" />
      <path d="M19 19h9v9h-9z" className="brand-mark__signal" />
    </svg>
  );
}

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

function Sidebar() {
  return (
    <aside className="sidebar">
      <a className="brand" href="/dashboard" aria-label="Northline operations home">
        <BrandMark />
        <span><strong>Northline</strong><small>Operations</small></span>
      </a>
      <nav aria-label="Primary navigation" className="primary-nav">
        <p className="nav-label">Workspace</p>
        {navItems.map((item) =>
          item.current ? (
            <a aria-current="page" className="nav-item is-current" href="/dashboard" key={item.label}>
              <span>{item.label}</span><small>{item.mark}</small>
            </a>
          ) : (
            <span aria-disabled="true" className="nav-item is-disabled" key={item.label}>
              <span>{item.label}</span><small>{item.mark}</small>
            </span>
          ),
        )}
      </nav>
      <div className="sidebar-note">
        <span className="status-light" />
        <div><strong>Systems nominal</strong><small>Updated 14:32 EDT</small></div>
      </div>
      <div className="profile">
        <span className="avatar">MC</span>
        <div><strong>Mara Chen</strong><small>Operations lead</small></div>
        <button aria-label="Open account menu" className="icon-button" type="button">•••</button>
      </div>
    </aside>
  );
}

function Topbar() {
  return (
    <header className="topbar">
      <div className="mobile-brand"><BrandMark /><strong>Northline</strong></div>
      <button className="search" type="button"><SearchIcon /><span>Search operations</span><kbd>⌘ K</kbd></button>
      <div className="topbar-meta"><span className="live-pill"><i />Live</span><span>US East</span><span>20 Aug 2026</span></div>
    </header>
  );
}

function LoadingDashboard() {
  return (
    <main className="dashboard" data-dashboard-state="loading" aria-busy="true">
      <section className="page-heading">
        <div><p className="eyebrow">Daily briefing</p><div className="skeleton skeleton--title" /></div>
        <div className="skeleton skeleton--button" />
      </section>
      <section aria-label="Loading metrics" className="metric-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <article className="metric-card is-loading" key={index}>
            <div className="skeleton skeleton--label" />
            <div className="skeleton skeleton--value" />
            <div className="skeleton skeleton--note" />
          </article>
        ))}
      </section>
      <section className="content-grid">
        <article className="panel chart-panel is-loading"><div className="skeleton skeleton--chart" /></article>
        <article className="panel queue-panel is-loading"><div className="skeleton skeleton--chart" /></article>
      </section>
    </main>
  );
}

function EmptyDashboard() {
  return (
    <main className="dashboard" data-dashboard-state="empty">
      <PageHeading />
      <section className="empty-state panel" aria-labelledby="empty-title">
        <div className="empty-state__visual" aria-hidden="true">
          <span>00</span><i /><i /><i />
        </div>
        <div>
          <p className="eyebrow">A clean slate</p>
          <h2 id="empty-title">No operations data yet.</h2>
          <p>Connect a storefront or import yesterday’s orders to start the daily briefing.</p>
          <button className="primary-action" type="button">Import orders <ArrowIcon /></button>
        </div>
      </section>
    </main>
  );
}

function ErrorDashboard({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <main className="dashboard" data-dashboard-state="error">
      <PageHeading />
      <section className="error-state panel" aria-labelledby="error-title">
        <div className="error-code" aria-hidden="true"><span>!</span><i>503</i></div>
        <div>
          <p className="eyebrow">Briefing interrupted</p>
          <h2 id="error-title">Operations data is out of reach.</h2>
          <p>{message} Your storefront is still taking orders; this view will catch up when the connection returns.</p>
          <div className="error-actions">
            <button className="primary-action" onClick={onRetry} type="button">Try again <ArrowIcon /></button>
            <span>Incident NL-0820-A</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function PageHeading() {
  return (
    <section className="page-heading">
      <div><p className="eyebrow">Daily briefing · Thursday, 20 August</p><h1>Good afternoon, Mara.</h1></div>
      <button className="primary-action" type="button">Export briefing <ArrowIcon /></button>
    </section>
  );
}

function MetricCards({ data }: Readonly<{ data: DashboardData }>) {
  return (
    <section aria-label="Key performance metrics" className="metric-grid">
      {data.metrics.map((metric, index) => (
        <article className="metric-card" key={metric.id}>
          <div className="metric-card__top"><p>{metric.label}</p><span>{String(index + 1).padStart(2, "0")}</span></div>
          <strong>{metric.value}</strong>
          <div className="metric-card__foot">
            <span className={`trend trend--${metric.direction}`}>{metric.change}</span>
            <small>{metric.note}</small>
          </div>
        </article>
      ))}
    </section>
  );
}

function PulseChart({ points }: Readonly<{ points: readonly number[] }>) {
  const coordinates = points.map((point, index) => `${index * 36},${110 - point}`).join(" ");
  const area = `0,120 ${coordinates} ${(points.length - 1) * 36},120`;
  return (
    <div className="chart" role="img" aria-label="Order volume trending upward across twelve intervals">
      <div className="chart-axis"><span>300</span><span>200</span><span>100</span><span>0</span></div>
      <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 396 120">
        <defs>
          <linearGradient id="pulse-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--signal)" stopOpacity=".42" />
            <stop offset="1" stopColor="var(--signal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 30H396M0 60H396M0 90H396" className="chart-grid" />
        <polygon fill="url(#pulse-fill)" points={area} />
        <polyline className="chart-line" fill="none" points={coordinates} />
      </svg>
      <div className="chart-labels"><span>06:00</span><span>10:00</span><span>14:00</span><span>18:00</span></div>
    </div>
  );
}

function statusClass(status: DashboardOrder["status"]): string {
  return status.toLowerCase().replaceAll(" ", "-");
}

function RecentOrders({ orders }: Readonly<{ orders: readonly DashboardOrder[] }>) {
  return (
    <article className="panel orders-panel">
      <div className="panel-heading"><div><p className="eyebrow">Latest movement</p><h2>Recent orders</h2></div><button className="text-action" type="button">View queue <ArrowIcon /></button></div>
      <div className="orders-table" role="table" aria-label="Recent orders">
        <div className="orders-row orders-row--head" role="row"><span role="columnheader">Order</span><span role="columnheader">Customer</span><span role="columnheader">Status</span><span role="columnheader">Amount</span></div>
        {orders.map((order) => (
          <div className="orders-row" role="row" key={order.id}>
            <span role="cell"><strong>{order.id}</strong><small>{order.region}</small></span>
            <span role="cell">{order.customer}</span>
            <span role="cell"><i className={`order-status order-status--${statusClass(order.status)}`}>{order.status}</i></span>
            <span role="cell">{order.amount}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function SuccessDashboard({ data }: Readonly<{ data: DashboardData }>) {
  return (
    <main className="dashboard" data-dashboard-state="success">
      <PageHeading />
      <MetricCards data={data} />
      <section className="content-grid">
        <article className="panel chart-panel">
          <div className="panel-heading"><div><p className="eyebrow">Order pulse · Today</p><h2>Volume is ahead of plan.</h2></div><div className="chart-total"><strong>1,248</strong><small>orders today</small></div></div>
          <PulseChart points={data.pulse} />
        </article>
        <article className="panel queue-panel">
          <p className="eyebrow">Needs attention</p>
          <strong className="risk-number">{data.summary.atRisk}</strong>
          <h2>Orders may miss their promise.</h2>
          <p>Most are waiting on the 16:30 carrier sweep. Two need address confirmation.</p>
          <button className="text-action" type="button">Open at-risk queue <ArrowIcon /></button>
          <div className="dispatch-strip"><span>Next dispatch</span><strong>{data.summary.nextDispatch}</strong></div>
        </article>
      </section>
      <RecentOrders orders={data.orders} />
      <footer className="briefing-footer"><span>{data.summary.fulfilledToday} fulfilled today</span><span>Data source · Northline Commerce API</span></footer>
    </main>
  );
}

export function DashboardShell() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DashboardState>({ kind: "loading" });

  const load = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    void fetch("/api/dashboard", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`The dashboard service returned ${response.status}.`);
        const data = parseDashboardData(await response.json());
        const kind = dashboardContentState(data);
        setState({ data, kind });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "The dashboard service could not be reached.",
        });
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="workspace">
        <Topbar />
        <div aria-live="polite" className="state-frame">
          {state.kind === "loading" ? <LoadingDashboard /> : null}
          {state.kind === "empty" ? <EmptyDashboard /> : null}
          {state.kind === "error" ? <ErrorDashboard message={state.message} onRetry={load} /> : null}
          {state.kind === "success" ? <SuccessDashboard data={state.data} /> : null}
        </div>
      </div>
    </div>
  );
}
