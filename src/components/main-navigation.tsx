
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Settings, Droplet, Zap, Users, ListTree, 
  ReceiptText, FileText as InvoiceIcon, DatabaseZap, ClipboardList, 
  Layers, PieChart, Archive, ArrowLeftCircle 
} from "lucide-react";
import { 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar 
} from "@/components/ui/sidebar";
import type { AppUserRole } from "@/types";
import { useEffect, useState } from "react";
import { useModule } from '@/context/module-context';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  restrictedToRoles?: AppUserRole[];
}

const powerNavItems: NavItem[] = [
  { href: "/mother-bill", label: "Mother Bill (Power)", icon: ReceiptText }, 
  { href: "/power", label: "Power Entry", icon: Zap },
  { href: "/power-readings", label: "Power Readings", icon: ListTree },
  { href: "/power-readings/reading-forms", label: "Reading Forms", icon: ClipboardList },
];

const waterNavItems: NavItem[] = [
  { href: "/mother-bill-water", label: "Mother Bill (Water)", icon: ReceiptText }, 
  { href: "/water", label: "Water Entry", icon: Droplet },
  { href: "/water-readings", label: "Water Readings", icon: ListTree },
  { href: "/water-readings/reading-forms", label: "Reading Forms", icon: ClipboardList },
];

const sharedFinancialNavItems: NavItem[] = [
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/invoicing", label: "Create Invoice", icon: InvoiceIcon },
  { href: "/batch-invoice", label: "Batch Invoice", icon: Layers },
  { href: "/invoices", label: "Invoice Records", icon: Archive },
  { href: "/manage-records", label: "Manage Records", icon: DatabaseZap, restrictedToRoles: ["billing-officer"] },
  { href: "/statistics", label: "Statistics", icon: PieChart },
];

const settingsNavItem: NavItem = { href: "/settings", label: "Settings", icon: Settings };

export function MainNavigation({ userRole: initialUserRole }: { userRole: AppUserRole | null }) {
  const pathname = usePathname();
  const { open } = useSidebar(); 
  const { selectedModule, clearModule } = useModule();
  const [currentUserRole, setCurrentUserRole] = useState<AppUserRole | null>(initialUserRole);

  useEffect(() => {
    if (initialUserRole) {
      setCurrentUserRole(initialUserRole);
    } else if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('pawUserRole') as AppUserRole | null;
      setCurrentUserRole(storedRole);
    }
  }, [initialUserRole]);

  const renderNavItems = (items: NavItem[]) => {
    return items
      .filter(item => !(item.restrictedToRoles && currentUserRole && item.restrictedToRoles.includes(currentUserRole)))
      .map((item) => {
        const NavIcon = item.icon; 
        
        let isActive = pathname === item.href;
        if (item.href !== "/" && pathname.startsWith(item.href)) {
           isActive = true;
        }
        
        // Special case to prevent parent from being active if child is active
        if (item.href === "/power-readings" && pathname !== "/power-readings") {
             isActive = false;
        }
        if (item.href === "/water-readings" && pathname !== "/water-readings") {
             isActive = false;
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
      });
  };

  if (!selectedModule) {
    return null; // Render nothing in the sidebar if no module is selected
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={clearModule}
          className="w-full justify-start"
          tooltip={{
            children: "Back to Module Selection",
            side: "right",
            align: "center",
            hidden: open,
          }}
        >
          <ArrowLeftCircle className="h-5 w-5" />
          <span>Change Module</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      
      <SidebarSeparator className="my-2" />
      
      {selectedModule === 'power' && renderNavItems(powerNavItems)}
      {selectedModule === 'water' && renderNavItems(waterNavItems)}

      <SidebarSeparator className="my-2" />
      
      {renderNavItems(sharedFinancialNavItems)}

      <SidebarSeparator className="my-2" />

      {renderNavItems([settingsNavItem])}
    </SidebarMenu>
  );
}
