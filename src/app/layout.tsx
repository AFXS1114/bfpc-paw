import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarFooter, // Added for potential future use
} from '@/components/ui/sidebar';
import { AppLogo } from '@/components/app-logo';
import { MainNavigation } from '@/components/main-navigation';
import { Button } from '@/components/ui/button';
import { UserCircle } from 'lucide-react';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'PAW - Power & Water Management',
  description: 'Record and manage power and water billing.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
                   {/* Placeholder for user profile or other footer items */}
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
