import type { SVGProps } from "react";
import { Icon } from "@/components/ui/icons";

export { ExternalIcon } from "@/components/ui/icons";

// Íconos del panel. La base (trazo 1.5px, 24x24) es la misma que la del resto de la app.
export const HomeIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
  </Icon>
);
export const InboxIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 13.5 6.5 5h11l2.5 8.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    <path d="M4 13.5h4.5l1 2h5l1-2H20" />
  </Icon>
);
export const CalendarIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="1.5" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </Icon>
);
export const UsersIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c1.9.7 3.1 2.5 3.5 5.2" />
  </Icon>
);
export const ImageIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <circle cx="9.5" cy="9.5" r="1.5" />
    <path d="m4 17 4.5-4.5L13 17l3-3 4 4" />
  </Icon>
);
export const SettingsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M10.3 3.6a1 1 0 0 1 1-.85h1.4a1 1 0 0 1 1 .85l.3 1.9a7 7 0 0 1 1.7 1l1.8-.7a1 1 0 0 1 1.2.43l.7 1.2a1 1 0 0 1-.23 1.27l-1.5 1.2a7 7 0 0 1 0 2l1.5 1.2a1 1 0 0 1 .23 1.27l-.7 1.2a1 1 0 0 1-1.2.43l-1.8-.7a7 7 0 0 1-1.7 1l-.3 1.9a1 1 0 0 1-1 .85h-1.4a1 1 0 0 1-1-.85l-.3-1.9a7 7 0 0 1-1.7-1l-1.8.7a1 1 0 0 1-1.2-.43l-.7-1.2a1 1 0 0 1 .23-1.27l1.5-1.2a7 7 0 0 1 0-2l-1.5-1.2a1 1 0 0 1-.23-1.27l.7-1.2a1 1 0 0 1 1.2-.43l1.8.7a7 7 0 0 1 1.7-1z" />
  </Icon>
);
