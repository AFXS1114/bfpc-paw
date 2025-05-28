
"use client"; // Required for using hooks like useEffect, useRouter, usePathname

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
import { Loader2, LogOut } from 'lucide-react'; // Changed UserCircle to LogOut
import { useToast } from '@/hooks/use-toast'; // Added useToast import

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [isVerifying, setIsVerifying] = useState(true);
  const { toast } = useToast(); // Initialize useToast

  useEffect(() => {
    document.title = 'PAW - Power & Water Management';

    const isVerified = localStorage.getItem('pawUserVerified') === 'true';
    if (!isVerified && pathname !== '/login') {
      router.replace('/login');
    } else {
      setIsVerifying(false);
    }
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem('pawUserVerified');
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
                  <MainNavigation />
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
