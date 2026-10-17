import type { ComponentType, SVGProps } from "react";
import { CalendarIcon, HomeIcon, ImageIcon, InboxIcon, SettingsIcon, UsersIcon } from "./icons";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Aparece en la barra inferior del celular (máximo 5). */
  mobile: boolean;
};

export const PANEL_NAV: NavItem[] = [
  { href: "/panel", label: "Inicio", icon: HomeIcon, mobile: true },
  { href: "/panel/solicitudes", label: "Solicitudes", icon: InboxIcon, mobile: true },
  { href: "/panel/agenda", label: "Agenda", icon: CalendarIcon, mobile: true },
  { href: "/panel/clientes", label: "Clientes", icon: UsersIcon, mobile: true },
  { href: "/panel/portfolio", label: "Portfolio", icon: ImageIcon, mobile: true },
  { href: "/panel/ajustes", label: "Ajustes", icon: SettingsIcon, mobile: false },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/panel" ? pathname === "/panel" : pathname === href || pathname.startsWith(`${href}/`);
}
