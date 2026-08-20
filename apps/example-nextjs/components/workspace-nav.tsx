"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { enabled: true, href: "/dashboard", label: "Overview", mark: "01" },
  { enabled: true, href: "/orders", label: "Orders", mark: "02" },
  { enabled: false, href: "/customers", label: "Customers", mark: "03" },
] as const;

export function WorkspaceNav({ mobile = false }: Readonly<{ mobile?: boolean }>) {
  const pathname = usePathname();
  const items = mobile ? navItems.filter((item) => item.enabled) : navItems;

  return (
    <nav aria-label={mobile ? "Mobile workspace navigation" : "Primary navigation"} className={mobile ? "mobile-nav" : "primary-nav"}>
      {mobile ? null : <p className="nav-label">Workspace</p>}
      {items.map((item) => {
        const current = item.enabled && pathname.startsWith(item.href);
        return item.enabled ? (
          <Link aria-current={current ? "page" : undefined} className={`nav-item${current ? " is-current" : ""}`} href={item.href} key={item.label}>
            <span>{item.label}</span><small>{item.mark}</small>
          </Link>
        ) : (
          <span aria-disabled="true" className="nav-item is-disabled" key={item.label}>
            <span>{item.label}</span><small>{item.mark}</small>
          </span>
        );
      })}
    </nav>
  );
}
