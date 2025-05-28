
// src/components/main-navigation.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, Droplet, Zap, BarChart3, Users, ListTree, ReceiptText, FileText as InvoiceIcon, DatabaseZap, ClipboardList } from "lucide-react";
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
  { href: "/power-readings/reading-forms", label: "Reading Forms", icon: ClipboardList, section: "Power Management" },
  { type: "separator", section: "Power Management_End"},

  // Water Management
  { href: "/mother-bill-water", label: "Mother Bill (Water)", icon: ReceiptText, section: "Water Management" }, 
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
    restrictedToRoles: ["billing-officer"] 
  },
  { 
    href: "/billing", 
    label: "Billing Summary", 
    icon: BarChart3, 
    section: "Client & Financials",
    restrictedToRoles: ["billing-officer"] 
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
    if (initialUserRole) {
      setCurrentUserRole(initialUserRole);
    } else if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('pawUserRole') as AppUserRole | null;
      setCurrentUserRole(storedRole);
    }
  }, [initialUserRole]);


  const filteredNavItems = allNavItems.filter(item => {
    if (item.restrictedToRoles && currentUserRole && item.restrictedToRoles.includes(currentUserRole)) {
      return false; 
    }
    return true;
  });

  return (
    <SidebarMenu>
      {filteredNavItems.map((item, index) => {
        if (item.type === "separator") {
          return <SidebarSeparator key={`separator-${item.section}-${index}`} className="my-2" />;
        }
        
        if (!item.href || !item.label || !item.icon) return null;
        
        const NavIcon = item.icon; 

        // For nested routes like /power-readings/reading-forms, we want /power-readings to also be active
        let isActive = pathname === item.href;
        if (item.href !== "/" && pathname.startsWith(item.href)) {
           // Make sure /power-readings is not active if /power-readings/reading-forms is active
           if (item.href === "/power-readings" && pathname === "/power-readings/reading-forms") {
                isActive = false;
           } else {
                isActive = true;
           }
        }
        // Specifically for the root /power-readings, ensure it's only active if not on a sub-route
        if (item.href === "/power-readings" && pathname.startsWith("/power-readings/") && pathname !== "/power-readings") {
             isActive = false;
        }
         if (item.href === "/power-readings/reading-forms" && pathname === "/power-readings/reading-forms"){
            isActive = true;
        }


        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
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

    