
"use client"; 

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
} from '@/components/ui/sidebar';
import { AppLogo } from '@/components/app-logo';
import { MainNavigation } from '@/components/main-navigation';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react'; 
import { useToast } from '@/hooks/use-toast';
import type { AppUserRole } from '@/types';
import { db } from "@/lib/firebase"; // Firestore instance
import { doc, updateDoc } from "firebase/firestore"; // For updating documents

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const RESTRICTED_PATHS_FOR_BILLING_OFFICER: string[] = ['/manage-records', '/billing'];

function generateNewPasscode(length: number = 6): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

async function renewUserPasscode(userId: string) {
  if (!userId) {
    console.error("Passcode renewal: User ID is missing.");
    return;
  }
  try {
    const newPasscode = generateNewPasscode(6);
    const userRef = doc(db, "app-users", userId);
    await updateDoc(userRef, {
      passcode: newPasscode,
    });
    console.log(`Passcode renewed for user ${userId}`);
  } catch (error) {
    console.error("Error renewing passcode for user:", userId, error);
    // Optionally, you could show a non-critical toast here if needed,
    // but typically background errors for logout are just logged.
  }
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [isVerifying, setIsVerifying] = useState(true);
  const { toast } = useToast(); 
  const [userRole, setUserRole] = useState<AppUserRole | null>(null);

  useEffect(() => {
    document.title = 'PAW - Power & Water Management';

    const isVerified = localStorage.getItem('pawUserVerified') === 'true';
    const storedRole = localStorage.getItem('pawUserRole') as AppUserRole | null;
    setUserRole(storedRole);

    if (!isVerified && pathname !== '/login') {
      router.replace('/login');
    } else if (isVerified && storedRole === 'billing-officer' && RESTRICTED_PATHS_FOR_BILLING_OFFICER.includes(pathname)) {
      toast({
        title: "Access Denied",
        description: "You do not have permission to access this page.",
        variant: "destructive",
      });
      router.replace('/'); 
    }
     else {
      setIsVerifying(false);
    }
  }, [pathname, router, toast]);

  const handleLogout = async () => {
    const currentRole = localStorage.getItem('pawUserRole') as AppUserRole | null;
    const currentUserId = localStorage.getItem('pawUserId');

    if (currentRole === 'billing-officer' && currentUserId) {
      await renewUserPasscode(currentUserId); // Attempt to renew passcode
    }

    localStorage.removeItem('pawUserVerified');
    localStorage.removeItem('pawUserRole'); 
    localStorage.removeItem('pawUserId'); // Clear user ID
    setUserRole(null);
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
    router.push('/login');
  };

  if (isVerifying && pathname !== '/login') {
    return (
      <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex items-center justify-center min-h-screen bg-background`}>
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </body>
      </html>
    );
  }
  
  if (pathname === '/login') {
     return (
      <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ThemeProvider defaultTheme="fire-dark" storageKey="paw-app-theme">
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider defaultTheme="fire-dark" storageKey="paw-app-theme">
          <SidebarProvider defaultOpen={true}>
            <div className="flex min-h-screen w-full">
              <Sidebar collapsible="icon" className="border-r">
                <SidebarHeader className="flex items-center justify-center p-4 h-16 border-b">
                  <AppLogo />
                </SidebarHeader>
                <SidebarContent className="flex-1 p-2">
                  <MainNavigation userRole={userRole} />
                </SidebarContent>
                <SidebarFooter className="p-2 border-t">
                  <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout}>
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                  </Button>
                </SidebarFooter>
              </Sidebar>
              <SidebarInset className="flex-1 flex flex-col overflow-y-auto">
                {children}
              </SidebarInset>
            </div>
            <Toaster />
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

    