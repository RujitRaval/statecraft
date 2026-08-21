"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  formatCustomerAmount,
  formatCustomerMetricAmount,
  parseCustomerData,
  type CustomerData,
  type CustomerOrderStatus,
} from "../lib/customer-contract";

type CustomerState =
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "loading" }
  | { readonly kind: "not-found" }
  | { readonly kind: "success"; readonly data: CustomerData }
  | { readonly kind: "unauthorized"; readonly status: 401 | 403 };

function ArrowIcon({ reverse = false }: Readonly<{ reverse?: boolean }>) {
  return (
    <svg aria-hidden="true" className={reverse ? "is-reversed" : undefined} viewBox="0 0 16 16">
      <path d="M3 8h9M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ContactIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" fill="none" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 21c.6-4.4 3.1-6.6 7.5-6.6s6.9 2.2 7.5 6.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32">
      <path d="M16 3 27 7v8c0 7-4.2 11.7-11 14-6.8-2.3-11-7-11-14V7z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 15.5h8M16 11.5v8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function statusClass(status: CustomerOrderStatus): string {
  return status.toLowerCase().replaceAll(" ", "-");
}

function LoadingCustomer() {
  return (
    <main aria-busy="true" className="customer-page" data-customer-state="loading">
      <div className="skeleton skeleton--customer-back" />
      <section className="customer-hero is-loading">
        <div><div className="skeleton skeleton--customer-kicker" /><div className="skeleton skeleton--customer-title" /><div className="skeleton skeleton--customer-subtitle" /></div>
        <div className="skeleton skeleton--customer-badge" />
      </section>
      <section aria-label="Loading customer summary" className="customer-metrics is-loading">
        {Array.from({ length: 4 }, (_, index) => <div className="skeleton skeleton--customer-metric" key={index} />)}
      </section>
      <section className="customer-layout is-loading">
        <div className="skeleton skeleton--customer-main" />
        <div className="skeleton skeleton--customer-side" />
      </section>
    </main>
  );
}

function UnauthorizedCustomer({ status }: Readonly<{ status: 401 | 403 }>) {
  return (
    <main className="customer-page" data-customer-state="unauthorized">
      <Link className="customer-back-link" href="/orders"><ArrowIcon reverse /> Return to orders</Link>
      <section aria-labelledby="customer-unauthorized-title" className="customer-access-state panel">
        <div aria-hidden="true" className="customer-access-state__visual"><ShieldIcon /><span>{status}</span></div>
        <div>
          <p className="eyebrow">Customer record restricted</p>
          <h1 id="customer-unauthorized-title">This account needs elevated access.</h1>
          <p>{status === 401 ? "Your Northline session could not be verified." : "Your Northline session is active, but this customer profile belongs to a restricted wholesale portfolio."} No contact, address, or order details were loaded.</p>
          <div className="customer-state-actions">
            <Link className="primary-action" href="/dashboard">Return to overview <ArrowIcon /></Link>
            <span>Ask an operations administrator for portfolio access.</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function MissingCustomer() {
  return (
    <main className="customer-page" data-customer-state="not-found">
      <Link className="customer-back-link" href="/orders"><ArrowIcon reverse /> Return to orders</Link>
      <section aria-labelledby="customer-missing-title" className="customer-access-state panel">
        <div aria-hidden="true" className="customer-access-state__visual"><strong className="customer-missing-mark">?</strong><span>404</span></div>
        <div>
          <p className="eyebrow">Customer record unavailable</p>
          <h1 id="customer-missing-title">This customer record was not found.</h1>
          <p>The requested account does not exist in this Northline workspace. No customer details were loaded.</p>
          <div className="customer-state-actions">
            <Link className="primary-action" href="/orders">Return to orders <ArrowIcon /></Link>
            <span>Check the customer link or locate the account from an order.</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function ErrorCustomer({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <main className="customer-page" data-customer-state="error">
      <Link className="customer-back-link" href="/orders"><ArrowIcon reverse /> Return to orders</Link>
      <section aria-labelledby="customer-error-title" className="customer-error-state panel">
        <div aria-hidden="true" className="customer-error-state__visual"><strong>!</strong><span>PROFILE OFFLINE</span></div>
        <div>
          <p className="eyebrow">Customer service interrupted</p>
          <h1 id="customer-error-title">The customer record did not arrive.</h1>
          <p>{message} No customer data was changed. Retry the profile before making a fulfillment decision.</p>
          <div className="customer-state-actions">
            <button className="primary-action" onClick={onRetry} type="button">Retry profile <ArrowIcon /></button>
            <span>Incident NL-0820-C · Account services</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function CustomerMetrics({ data }: Readonly<{ data: CustomerData }>) {
  const averageOrderCents = data.metrics.orderCount === 0
    ? 0
    : Math.round(data.metrics.lifetimeValueCents / data.metrics.orderCount);
  return (
    <section aria-label="Customer account summary" className="customer-metrics">
      <div><span>Lifetime value</span><strong>{formatCustomerMetricAmount(data.metrics.lifetimeValueCents)}</strong><small>{data.metrics.orderCount} orders placed</small></div>
      <div><span>Open orders</span><strong>{data.metrics.openOrders}</strong><small>across active windows</small></div>
      <div><span>At risk</span><strong className="customer-metric-risk">{data.metrics.atRiskOrders}</strong><small>needs intervention</small></div>
      <div><span>Average order</span><strong>{formatCustomerMetricAmount(averageOrderCents)}</strong><small>lifetime average</small></div>
    </section>
  );
}

function RecentOrders({ data }: Readonly<{ data: CustomerData }>) {
  return (
    <section aria-labelledby="customer-orders-title" className="customer-section panel">
      <div className="customer-section__heading">
        <div><p className="eyebrow">Order history</p><h2 id="customer-orders-title">Recent commitments</h2></div>
        <Link href={`/orders?q=${encodeURIComponent(data.name)}`}>View queue <ArrowIcon /></Link>
      </div>
      <ul aria-label="Recent customer orders" className="customer-order-list">
        {data.recentOrders.map((order) => (
          <li key={order.id}>
            <Link className="customer-order" href={`/orders?q=${encodeURIComponent(order.id)}`}>
              <span><strong>{order.id}</strong><small>{order.placedAt}</small></span>
              <i className={`order-status order-status--${statusClass(order.status)}`}>{order.status}</i>
              <b>{formatCustomerAmount(order.amountCents)}</b>
              <ArrowIcon />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RelationshipTimeline({ data }: Readonly<{ data: CustomerData }>) {
  return (
    <section aria-labelledby="customer-activity-title" className="customer-section panel">
      <div className="customer-section__heading"><div><p className="eyebrow">Relationship log</p><h2 id="customer-activity-title">Latest account activity</h2></div><span>{data.updatedAt}</span></div>
      <ol className="customer-timeline">
        {data.activities.map((activity) => (
          <li key={activity.id}>
            <span aria-hidden="true" />
            <div><time>{activity.occurredAt}</time><h3>{activity.title}</h3><p>{activity.detail}</p></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CustomerSidebar({ data }: Readonly<{ data: CustomerData }>) {
  return (
    <aside aria-label="Customer account details" className="customer-sidebar">
      <section className="customer-contact-card panel">
        <div className="customer-contact-card__icon"><ContactIcon /></div>
        <p className="eyebrow">Primary contact</p>
        <h2>{data.primaryContact.name}</h2>
        <p>{data.primaryContact.role}</p>
        <a href={`mailto:${data.primaryContact.email}`}>{data.primaryContact.email}</a>
        <a href={`tel:${data.primaryContact.phone.replaceAll(" ", "")}`}>{data.primaryContact.phone}</a>
      </section>
      <section className="customer-detail-card panel">
        <p className="eyebrow">Delivery profile</p>
        <dl>
          <div><dt>Warehouse</dt><dd>{data.warehouse}</dd></div>
          <div><dt>Receiving window</dt><dd>{data.deliveryWindow}</dd></div>
          <div><dt>Ship to</dt><dd>{data.deliveryAddress.map((line) => <span key={line}>{line}</span>)}</dd></div>
          <div><dt>Account owner</dt><dd>{data.accountOwner}</dd></div>
        </dl>
      </section>
      <section className="customer-note panel">
        <p className="eyebrow">Account note</p>
        <h2>{data.note.title}</h2>
        <p>{data.note.body}</p>
        <footer><span>{data.note.author}</span><span>{data.note.updatedAt}</span></footer>
      </section>
    </aside>
  );
}

function SuccessCustomer({ data }: Readonly<{ data: CustomerData }>) {
  return (
    <main className="customer-page" data-customer-state="success">
      <Link className="customer-back-link" href="/orders"><ArrowIcon reverse /> Return to orders</Link>
      <section className="customer-hero">
        <div>
          <p className="eyebrow">Customer record · {data.id}</p>
          <h1>{data.name}</h1>
          <p>{data.tier}</p>
          <div className="customer-hero__meta"><span>{data.region}</span><span>{data.joinedAt}</span><span>Owner · {data.accountOwner}</span></div>
        </div>
        <div className="customer-status-card">
          <span><i />{data.status} account</span>
          <strong>Priority 04</strong>
          <small>Service review · 02 Sep</small>
        </div>
      </section>
      <CustomerMetrics data={data} />
      <section className="customer-layout">
        <div className="customer-main-column"><RecentOrders data={data} /><RelationshipTimeline data={data} /></div>
        <CustomerSidebar data={data} />
      </section>
      <footer className="briefing-footer"><span>Account record · {data.id}</span><span>Data source · Northline Customer API</span></footer>
    </main>
  );
}

export function CustomerShell({ customerId }: Readonly<{ customerId: string }>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CustomerState>({ kind: "loading" });
  const load = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    void fetch(`/api/customers/${encodeURIComponent(customerId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          setState({ kind: "unauthorized", status: response.status });
          return;
        }
        if (response.status === 404) {
          setState({ kind: "not-found" });
          return;
        }
        if (!response.ok) throw new Error(`The customer service returned ${response.status}.`);
        const data = parseCustomerData(await response.json());
        if (data.id !== customerId) throw new Error("The customer service returned a mismatched record.");
        setState({ data, kind: "success" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "The customer service could not be reached.",
        });
      });
    return () => controller.abort();
  }, [attempt, customerId]);

  const announcement = state.kind === "success"
    ? `Customer record loaded for ${state.data.name}.`
    : state.kind === "loading"
      ? "Loading customer record."
      : state.kind === "unauthorized"
        ? "Customer record access denied."
        : state.kind === "not-found"
          ? "Customer record not found."
          : "Customer record failed to load.";

  return (
    <div className="state-frame">
      <p aria-atomic="true" className="sr-only" role="status">{announcement}</p>
      {state.kind === "loading" ? <LoadingCustomer /> : null}
      {state.kind === "unauthorized" ? <UnauthorizedCustomer status={state.status} /> : null}
      {state.kind === "not-found" ? <MissingCustomer /> : null}
      {state.kind === "error" ? <ErrorCustomer message={state.message} onRetry={load} /> : null}
      {state.kind === "success" ? <SuccessCustomer data={state.data} /> : null}
    </div>
  );
}
