"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { SettingsIcon } from "./icons";
import { isActive, PANEL_NAV } from "./nav-items";

export function PanelSidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Panel" className="flex flex-col gap-1">
      {PANEL_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-200",
              active ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-1 hover:text-fg",
            )}
          >
            <item.icon className={cn("size-5", active && "text-accent-text")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PanelBottomBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Panel"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {PANEL_NAV.filter((item) => item.mobile).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px]",
                  active ? "text-fg" : "text-fg-subtle",
                )}
              >
                <item.icon className={cn("size-6", active && "text-accent-text")} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileSettingsLink() {
  const pathname = usePathname();
  const active = isActive(pathname, "/panel/ajustes");
  return (
    <Link
      href="/panel/ajustes"
      aria-label="Ajustes"
      aria-current={active ? "page" : undefined}
      className={cn("flex size-10 items-center justify-center rounded-full lg:hidden", active ? "text-fg" : "text-fg-muted")}
    >
      <SettingsIcon className="size-6" />
    </Link>
  );
}
