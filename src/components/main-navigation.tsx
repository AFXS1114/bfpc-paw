
// src/components/main-navigation.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Settings, Droplet, Zap, BarChart3, LayoutDashboard, Users, ListTree, ReceiptText } from "lucide-react";
import { 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  useSidebar 
} from "@/components/ui/sidebar";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/mother-bill", label: "Mother Bill (Power)", icon: ReceiptText }, 
  { href: "/mother-bill-water", label: "Mother Bill (Water)", icon: Droplet }, // New Water Mother Bill Link
  { href: "/power", label: "Power Entry", icon: Zap },
  { href: "/power-readings", label: "Power Readings", icon: ListTree },
  { href: "/water", label: "Water", icon: Droplet }, // This might be for individual tenant water entry later
  { href: "/billing", label: "Billing", icon: BarChart3 },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MainNavigation() {
  const pathname = usePathname();
  const { open } = useSidebar(); // To adjust tooltip behavior based on sidebar state

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))}
            className="w-full justify-start"
            tooltip={{
              children: item.label,
              side: "right",
              align: "center",
              hidden: open, // Only show tooltip when sidebar is collapsed (not open)
            }}
          >
            <Link href={item.href}>
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
