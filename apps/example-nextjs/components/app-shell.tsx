import type { ReactNode } from "react";

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

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="workspace">
        <Topbar />
        {children}
      </div>
    </div>
  );
}
