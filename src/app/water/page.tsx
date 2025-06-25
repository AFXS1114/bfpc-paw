
"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export default function WaterPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Water Management" />
      <div className="flex-1 flex items-center justify-center p-4 md:p-6">
        <Card className="shadow-lg max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
              <Wrench className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="mt-4 text-2xl">Page Under Development</CardTitle>
            <CardDescription>
              This feature is currently being built. Please check back later!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              The water reading entry and management system is not yet functional. We are working hard to bring this feature to you soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
