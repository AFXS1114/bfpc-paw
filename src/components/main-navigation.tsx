
// src/components/main-navigation.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, Droplet, Zap, BarChart3, Users, ListTree, ReceiptText, FileText as InvoiceIcon } from "lucide-react";
import { 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar 
} from "@/components/ui/sidebar";

const navItems = [
  // Overview
  { href: "/", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { type: "separator", section: "Overview_End"},

  // Power Management
  { href: "/mother-bill", label: "Mother Bill (Power)", icon: ReceiptText, section: "Power Management" }, 
  { href: "/power", label: "Power Entry", icon: Zap, section: "Power Management" },
  { href: "/power-readings", label: "Power Readings", icon: ListTree, section: "Power Management" },
  { type: "separator", section: "Power Management_End"},

  // Water Management
  { href: "/mother-bill-water", label: "Mother Bill (Water)", icon: Droplet, section: "Water Management" }, 
  { href: "/water", label: "Water", icon: Droplet, section: "Water Management" }, 
  { type: "separator", section: "Water Management_End"},
  
  // Client & Financials
  { href: "/clients", label: "Clients", icon: Users, section: "Client & Financials" },
  { href: "/invoicing", label: "Invoicing", icon: InvoiceIcon, section: "Client & Financials" },
  { href: "/billing", label: "Billing Summary", icon: BarChart3, section: "Client & Financials" }, 
  { type: "separator", section: "Client & Financials_End"},

  // Application
  { href: "/settings", label: "Settings", icon: Settings, section: "Application" },
];

export function MainNavigation() {
  const pathname = usePathname();
  const { open } = useSidebar(); 

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
                hidden: open, 
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
