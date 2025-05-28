
"use client";

import type { AppUserRole, ClientDocument } from "@/types"; // Ensure ClientDocument is imported
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Palette, DatabaseBackup, Loader2, Users, UserPlus, Edit3, UserCog, List, UploadCloud } from "lucide-react";
import { importHistoricalMotherBills } from "@/lib/import-mother-bills";
import { AddUserModal } from "@/components/add-user-modal";
import { ViewUsersModal } from "@/components/view-users-modal"; 
import { AddSignatoryModal } from "@/components/add-signatory-modal";
import { AddReadingPerformerModal } from "@/components/add-reading-performer-modal";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, where, getDocs, limit, Timestamp } from "firebase/firestore";
import type { PowerReadingEntry } from "@/types";
import reftechDataJson from '@/lib/reftech.json'; // Direct import of the JSON data

const MONTHS_FOR_PARSING = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isViewUsersModalOpen, setIsViewUsersModalOpen] = useState(false);
  const [isAddSignatoryModalOpen, setIsAddSignatoryModalOpen] = useState(false);
  const [isAddReadingPerformerModalOpen, setIsAddReadingPerformerModalOpen] = useState(false);
  const [userRole, setUserRole] = useState<AppUserRole | null>(null);

  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [selectedClientIdForImport, setSelectedClientIdForImport] = useState<string>("");
  const [isImportingClientReadings, setIsImportingClientReadings] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('pawUserRole') as AppUserRole | null;
      setUserRole(storedRole);
    }

    // Fetch clients for the import dropdown
    setIsLoadingClients(true);
    const clientsQuery = query(collection(db, "clients"), orderBy("clientName", "asc"));
    const unsubscribeClients = onSnapshot(clientsQuery, (querySnapshot) => {
      const clientsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as ClientDocument));
      setClients(clientsData);
      setIsLoadingClients(false);
    }, (error) => {
      console.error("Error fetching clients for import: ", error);
      toast({ title: "Error", description: "Failed to fetch clients for import dropdown.", variant: "destructive" });
      setIsLoadingClients(false);
    });
    
    return () => {
      unsubscribeClients();
    };
  }, [toast]);

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

  const handleImportReftechReadings = async () => {
    if (!selectedClientIdForImport) {
      toast({ title: "Client Not Selected", description: "Please select a client to assign these readings to.", variant: "destructive" });
      return;
    }
    setIsImportingClientReadings(true);

    const selectedClient = clients.find(c => c.id === selectedClientIdForImport);
    if (!selectedClient) {
      toast({ title: "Error", description: "Selected client data not found.", variant: "destructive" });
      setIsImportingClientReadings(false);
      return;
    }

    let importedCount = 0;
    let skippedCount = 0;
    const readingsCollection = collection(db, "power-readings");

    // The reftechDataJson is an object where keys are arbitrary and values are the records
    const recordsToImport = Object.values(reftechDataJson);

    for (const record of recordsToImport) {
      try {
        const billingMonthYear = (record["BILLING MONTH"] as string).split(" ");
        const billingMonth = billingMonthYear[0];
        const billingYear = parseInt(billingMonthYear[1], 10);

        // Duplicate check
        const q = query(
          readingsCollection,
          where("clientId", "==", selectedClient.id),
          where("billingMonth", "==", billingMonth),
          where("billingYear", "==", billingYear),
          limit(1)
        );
        const existingSnapshot = await getDocs(q);
        if (!existingSnapshot.empty) {
          skippedCount++;
          console.log(`Skipping duplicate for ${selectedClient.clientName}, ${billingMonth} ${billingYear}`);
          continue;
        }

        const monthIndex = MONTHS_FOR_PARSING.indexOf(billingMonth);
        if (monthIndex === -1) {
            console.warn(`Invalid month string: ${billingMonth} in record:`, record);
            skippedCount++;
            continue;
        }
        const dateBilled = new Date(billingYear, monthIndex, 1); // Default to 1st of the month

        const newReadingEntry: Omit<PowerReadingEntry, 'id' | 'createdAt'> = {
          clientId: selectedClient.id,
          clientName: selectedClient.clientName,
          stallNo: selectedClient.stallNo,
          powerMeterNo: selectedClient.powerMeterNo,
          dateBilled: Timestamp.fromDate(dateBilled),
          billingMonth: billingMonth,
          billingYear: billingYear,
          previousReading: Number(record.Previous) || 0,
          presentReading: Number(record.Present) || 0,
          totalKwh: Number(record["KWH Used"]) || 0,
          notes: "Imported from reftech.json",
        };

        await addDoc(readingsCollection, {
          ...newReadingEntry,
          createdAt: serverTimestamp(),
        });
        importedCount++;
      } catch (e) {
        console.error("Error importing a Reftech record: ", record, e);
        toast({
          title: "Partial Import Error",
          description: `Error importing record for billing month ${record["BILLING MONTH"]}. Check console.`,
          variant: "destructive",
        });
      }
    }

    toast({
      title: "Reftech Import Complete",
      description: `${importedCount} records imported. ${skippedCount} records skipped (duplicates or errors).`,
    });
    setIsImportingClientReadings(false);
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
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Import historical mother bill data from a predefined JSON structure.
                </p>
                <Button onClick={handleImportData} disabled={isImporting}>
                  {isImporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <DatabaseBackup className="mr-2 h-4 w-4" />
                  )}
                  Import Historical Mother Bills
                </Button>
              </div>
              <hr className="my-4"/>
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Import power readings for a specific client from `reftech.json`.
                </p>
                 <p className="text-xs text-muted-foreground mb-3">
                  This file is located in `src/lib/reftech.json`. Ensure it's correctly formatted.
                </p>
                <div className="space-y-3 max-w-md">
                  <div>
                    <Label htmlFor="select-client-for-import">Assign Readings to Client</Label>
                    <Select
                      value={selectedClientIdForImport}
                      onValueChange={setSelectedClientIdForImport}
                      disabled={isLoadingClients || isImportingClientReadings}
                    >
                      <SelectTrigger id="select-client-for-import" className="mt-1">
                        <SelectValue placeholder={isLoadingClients ? "Loading clients..." : "Select a client"} />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.clientName} ({client.stallNo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleImportReftechReadings} 
                    disabled={isImportingClientReadings || !selectedClientIdForImport || isLoadingClients}
                    className="w-full"
                  >
                    {isImportingClientReadings ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="mr-2 h-4 w-4" />
                    )}
                    Import Reftech Client Readings
                  </Button>
                </div>
              </div>
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
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setIsAddUserModalOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" /> Add App User
                </Button>
                <Button variant="outline" onClick={() => setIsViewUsersModalOpen(true)}>
                  <List className="mr-2 h-4 w-4" /> View App Users
                </Button>
              </div>
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
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setIsAddSignatoryModalOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" /> Add Invoice Signatory
              </Button>
              <Button onClick={() => setIsAddReadingPerformerModalOpen(true)} variant="outline">
                <UserCog className="mr-2 h-4 w-4" /> Add Reading Performer 
              </Button>
            </div>
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
      <ViewUsersModal isOpen={isViewUsersModalOpen} onOpenChange={setIsViewUsersModalOpen} /> 
      <AddSignatoryModal isOpen={isAddSignatoryModalOpen} onOpenChange={setIsAddSignatoryModalOpen} />
      <AddReadingPerformerModal isOpen={isAddReadingPerformerModalOpen} onOpenChange={setIsAddReadingPerformerModalOpen} />
    </main>
  );
}

    