
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Settings, Droplet, Zap, Users, ListTree, 
  ReceiptText, FileText as InvoiceIcon, DatabaseZap, ClipboardList, 
  Layers, PieChart, Archive, ArrowLeftCircle, Tags
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
  { href: "/monthly-rates", label: "Monthly Rates", icon: Tags },
  { href: "/invoicing", label: "Create Invoice", icon: InvoiceIcon },
  { href: "/batch-invoice-power", label: "Batch Invoice", icon: Layers },
];

const waterNavItems: NavItem[] = [
  { href: "/mother-bill-water", label: "Mother Bill (Water)", icon: ReceiptText }, 
  { href: "/water", label: "Water Entry", icon: Droplet },
  { href: "/water-readings", label: "Water Readings", icon: ListTree },
  { href: "/water-readings/reading-forms", label: "Reading Forms", icon: ClipboardList },
  { href: "/invoicing", label: "Create Invoice", icon: InvoiceIcon },
  { href: "/batch-invoice-water", label: "Batch Invoice", icon: Layers },
];

const sharedFinancialNavItems: NavItem[] = [
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/invoices", label: "Invoice Records", icon: Archive },
  { href: "/manage-records", label: "Manage Records", icon: DatabaseZap, restrictedToRoles: ["system-admin"] },
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
      .filter(item => {
        // Hide item if user role is in the restricted list
        if (item.restrictedToRoles && currentUserRole) {
            return !item.restrictedToRoles.includes(currentUserRole);
        }
        // Special case for 'manage-records': only 'system-admin' can see it.
        if (item.href === '/manage-records') {
            return currentUserRole === 'system-admin';
        }
        return true;
      })
      .map((item) => {
        const NavIcon = item.icon; 
        
        let isActive = pathname === item.href;
        if (item.href !== "/" && pathname.startsWith(item.href)) {
           isActive = true;
        }
        
        // Special case to prevent parent from being active if child is active
        const specificReadingPaths = ["/power-readings/reading-forms", "/water-readings/reading-forms"];
        if ((item.href === "/power-readings" || item.href === "/water-readings") && specificReadingPaths.includes(pathname)) {
             isActive = false;
        }
        if (item.href === "/power-readings" && pathname.startsWith("/monthly-rates")) {
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
