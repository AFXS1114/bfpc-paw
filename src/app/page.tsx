"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppUserRole } from "@/types";
import { APP_USER_ROLE_LABELS } from "@/types";

export default function DashboardPage() {
  const [userInfo, setUserInfo] = useState<{ name: string; role: string }>({ name: '', role: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedName = localStorage.getItem('pawUserName');
    const storedRole = localStorage.getItem('pawUserRole') as AppUserRole | null;
    
    const roleLabel = storedRole ? APP_USER_ROLE_LABELS[storedRole] : 'User';

    setUserInfo({
      name: storedName || 'User',
      role: roleLabel,
    });
    setIsLoading(false);
  }, []);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Dashboard" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl">
              {isLoading ? (
                <Skeleton className="h-8 w-64" />
              ) : (
                `Welcome ${userInfo.role}: ${userInfo.name}`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This is your main dashboard. Future updates will include system overviews and key statistics.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
