
// src/components/main-navigation.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Settings, Droplet, Zap, BarChart3, LayoutDashboard, Users, ListTree, ReceiptText, FileText as InvoiceIcon } from "lucide-react";
import { 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarSeparator, // Import SidebarSeparator
  useSidebar 
} from "@/components/ui/sidebar";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { type: "separator", section: "Overview_End"},
  { href: "/mother-bill", label: "Mother Bill (Power)", icon: ReceiptText, section: "Mother Bills" }, 
  { href: "/mother-bill-water", label: "Mother Bill (Water)", icon: Droplet, section: "Mother Bills" }, 
  { type: "separator", section: "Mother Bills_End"},
  { href: "/clients", label: "Clients", icon: Users, section: "Client Management" },
  { href: "/power", label: "Power Entry", icon: Zap, section: "Client Management" },
  { href: "/power-readings", label: "Power Readings", icon: ListTree, section: "Client Management" },
  { href: "/water", label: "Water", icon: Droplet, section: "Client Management" }, // This might be for individual tenant water entry later
  { href: "/invoicing", label: "Invoicing", icon: InvoiceIcon, section: "Client Management" },
  { type: "separator", section: "Client Management_End"},
  { href: "/billing", label: "Billing Summary", icon: BarChart3, section: "Reports & Summaries" }, 
  { type: "separator", section: "Reports & Summaries_End"},
  { href: "/settings", label: "Settings", icon: Settings, section: "Application" },
];

export function MainNavigation() {
  const pathname = usePathname();
  const { open } = useSidebar(); // To adjust tooltip behavior based on sidebar state

  return (
    <SidebarMenu>
      {navItems.map((item, index) => {
        if (item.type === "separator") {
          return <SidebarSeparator key={`separator-${item.section}-${index}`} className="my-2" />;
        }
        return (
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
        );
      })}
    </SidebarMenu>
  );
}
