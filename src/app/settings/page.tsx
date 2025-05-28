
"use client";

import type { AppUserRole } from "@/types"; // Ensure AppUserRole is imported
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Palette, DatabaseBackup, Loader2, Users, UserPlus, Edit3, UserCog } from "lucide-react"; 
import { importHistoricalMotherBills } from "@/lib/import-mother-bills";
import { AddUserModal } from "@/components/add-user-modal";
import { AddSignatoryModal } from "@/components/add-signatory-modal";
import { AddReadingPerformerModal } from "@/components/add-reading-performer-modal"; 

export default function SettingsPage() {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isAddSignatoryModalOpen, setIsAddSignatoryModalOpen] = useState(false);
  const [isAddReadingPerformerModalOpen, setIsAddReadingPerformerModalOpen] = useState(false);
  const [userRole, setUserRole] = useState<AppUserRole | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('pawUserRole') as AppUserRole | null;
      setUserRole(storedRole);
    }
  }, []);

  const handleImportData = async () => {
    setIsImporting(true);
    try {
      const result = await importHistoricalMotherBills();
      if (result.success) {
        toast({
          title: "Import Successful",
          description: `${result.count} historical mother bill records imported.`,
        });
      } else {
        throw new Error(result.error || "Unknown error during import.");
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast({
        title: "Import Failed",
        description: (error as Error).message || "Could not import historical mother bills. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const canManageUsersAndData = userRole !== 'billing-officer';

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Settings" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-6 w-6 text-primary" />
              Appearance
            </CardTitle>
            <CardDescription>Customize the look and feel of the application.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeSwitcher />
          </CardContent>
        </Card>
        
        {canManageUsersAndData && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DatabaseBackup className="h-6 w-6 text-primary" />
                Data Management
              </CardTitle>
              <CardDescription>One-time data import utilities.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use this button to import historical mother bill data from the predefined JSON structure.
                This is a one-time operation.
              </p>
              <Button onClick={handleImportData} disabled={isImporting}>
                {isImporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <DatabaseBackup className="mr-2 h-4 w-4" />
                )}
                Import Historical Mother Bills
              </Button>
            </CardContent>
          </Card>
        )}

        {canManageUsersAndData && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                User Management
              </CardTitle>
              <CardDescription>Manage application users.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => setIsAddUserModalOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" /> Add App User
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                App user list and editing capabilities will be added here in the future.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="h-6 w-6 text-primary" /> 
              Signatories & Performers
            </CardTitle>
            <CardDescription>Manage personnel involved in billing and readings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => setIsAddSignatoryModalOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Add Invoice Signatory
            </Button>
            <Button onClick={() => setIsAddReadingPerformerModalOpen(true)} variant="outline">
              <UserCog className="mr-2 h-4 w-4" /> Add Reading Performer 
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Personnel lists and editing capabilities will be added here in the future.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>Manage your account details (placeholder).</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Account management options will be here.</p>
          </CardContent>
        </Card>
      </div>
      <AddUserModal isOpen={isAddUserModalOpen} onOpenChange={setIsAddUserModalOpen} />
      <AddSignatoryModal isOpen={isAddSignatoryModalOpen} onOpenChange={setIsAddSignatoryModalOpen} />
      <AddReadingPerformerModal isOpen={isAddReadingPerformerModalOpen} onOpenChange={setIsAddReadingPerformerModalOpen} />
    </main>
  );
}
