
"use client"; 

import type { ReactNode } from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
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
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const RESTRICTED_PATHS_FOR_BILLING_OFFICER: string[] = ['/manage-records', '/billing'];
const INACTIVITY_TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes

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
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(async (reason?: string) => {
    const currentRole = localStorage.getItem('pawUserRole') as AppUserRole | null;
    const currentUserId = localStorage.getItem('pawUserId');

    if (currentRole === 'billing-officer' && currentUserId) {
      await renewUserPasscode(currentUserId); 
    }

    localStorage.removeItem('pawUserVerified');
    localStorage.removeItem('pawUserRole'); 
    localStorage.removeItem('pawUserId'); 
    setUserRole(null);
    
    toast({
      title: reason ? "Session Expired" : "Logged Out",
      description: reason || "You have been successfully logged out.",
    });
    router.push('/login');
  }, [router, toast]);


  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // Only set the timer if the user is verified and not on the login page
    const isVerified = localStorage.getItem('pawUserVerified') === 'true';
    if (isVerified && pathname !== '/login') {
      inactivityTimerRef.current = setTimeout(() => {
        handleLogout("Logged out due to inactivity.");
      }, INACTIVITY_TIMEOUT_DURATION);
    }
  }, [pathname, handleLogout]);

  const handleUserActivity = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

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
    } else {
      setIsVerifying(false);
    }

    // Inactivity timer logic
    if (isVerified && pathname !== '/login') {
      const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
      events.forEach(event => window.addEventListener(event, handleUserActivity));
      resetInactivityTimer(); // Start or reset the timer

      return () => {
        events.forEach(event => window.removeEventListener(event, handleUserActivity));
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
      };
    } else {
      // If not verified or on login page, clear any existing timer
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    }

  }, [pathname, router, toast, handleUserActivity, resetInactivityTimer]);


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
                  <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => handleLogout()}>
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
    
