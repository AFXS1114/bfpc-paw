
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
  SidebarInset, // Added SidebarInset to imports
} from '@/components/ui/sidebar';
import { AppLogo } from '@/components/app-logo';
import { MainNavigation } from '@/components/main-navigation';
import { Button } from '@/components/ui/button';
import { UserCircle, Loader2 } from 'lucide-react';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// export const metadata: Metadata = { // Cannot use static metadata with "use client"
//   title: 'PAW - Power & Water Management',
//   description: 'Record and manage power and water billing.',
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [isVerifying, setIsVerifying] = useState(true); // Start with verifying state

  useEffect(() => {
    // Set document title dynamically
    document.title = 'PAW - Power & Water Management';

    const isVerified = localStorage.getItem('pawUserVerified') === 'true';
    if (!isVerified && pathname !== '/login') {
      router.replace('/login');
    } else {
      setIsVerifying(false); // Verification done
    }
  }, [pathname, router]);

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
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    <UserCircle className="h-5 w-5" />
                    <span>Profile</span>
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
