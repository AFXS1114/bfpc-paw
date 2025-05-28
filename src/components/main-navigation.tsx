
// src/components/main-navigation.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, Droplet, Zap, BarChart3, Users, ListTree, ReceiptText, FileText as InvoiceIcon, DatabaseZap } from "lucide-react";
import { 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar 
} from "@/components/ui/sidebar";
import type { AppUserRole } from "@/types";
import { useEffect, useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  section: string;
  type?: undefined;
  restrictedToRoles?: AppUserRole[]; // Roles that CANNOT see this item
}

interface SeparatorItem {
  type: "separator";
  section: string;
  href?: undefined;
  label?: undefined;
  icon?: undefined;
  restrictedToRoles?: AppUserRole[];
}

type NavigationItem = NavItem | SeparatorItem;


const allNavItems: NavigationItem[] = [
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
  { href: "/water", label: "Water Entry", icon: Droplet, section: "Water Management" }, 
  { type: "separator", section: "Water Management_End"},
  
  // Client & Financials
  { href: "/clients", label: "Clients", icon: Users, section: "Client & Financials" },
  { href: "/invoicing", label: "Invoicing", icon: InvoiceIcon, section: "Client & Financials" },
  { 
    href: "/manage-records", 
    label: "Manage Records", 
    icon: DatabaseZap, 
    section: "Client & Financials",
    restrictedToRoles: ["billing-officer"] // Only billing officers cannot see this
  },
  { 
    href: "/billing", 
    label: "Billing Summary", 
    icon: BarChart3, 
    section: "Client & Financials",
    restrictedToRoles: ["billing-officer"] // Only billing officers cannot see this
  }, 
  { type: "separator", section: "Client & Financials_End"},

  // Application
  { href: "/settings", label: "Settings", icon: Settings, section: "Application" },
];

interface MainNavigationProps {
  userRole: AppUserRole | null;
}

export function MainNavigation({ userRole: initialUserRole }: MainNavigationProps) {
  const pathname = usePathname();
  const { open } = useSidebar(); 
  const [currentUserRole, setCurrentUserRole] = useState<AppUserRole | null>(initialUserRole);

  useEffect(() => {
    // This ensures that if the role is updated elsewhere (e.g. on login/logout in layout),
    // the navigation re-renders based on the prop.
    // It also tries to get it from localStorage if not passed or on initial client render.
    if (initialUserRole) {
      setCurrentUserRole(initialUserRole);
    } else if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('pawUserRole') as AppUserRole | null;
      setCurrentUserRole(storedRole);
    }
  }, [initialUserRole]);


  const filteredNavItems = allNavItems.filter(item => {
    if (item.restrictedToRoles && currentUserRole && item.restrictedToRoles.includes(currentUserRole)) {
      return false; // Hide if current user's role is in the restricted list for this item
    }
    return true;
  });

  return (
    <SidebarMenu>
      {filteredNavItems.map((item, index) => {
        if (item.type === "separator") {
          return <SidebarSeparator key={`separator-${item.section}-${index}`} className="my-2" />;
        }
        // Type guard for NavItem
        if (!item.href || !item.label || !item.icon) return null;
        
        const NavIcon = item.icon; // Ensure item.icon is treated as a component type

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
                <NavIcon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
