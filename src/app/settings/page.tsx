
"use client";

import type { AppUserRole, ClientDocument } from "@/types";
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
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Palette, DatabaseBackup, Loader2, Users, UserPlus, Edit3, UserCog, List, UploadCloud, Eye } from "lucide-react"; // Added Eye
import { importHistoricalMotherBills } from "@/lib/import-mother-bills";
import { AddUserModal } from "@/components/add-user-modal";
import { ViewUsersModal } from "@/components/view-users-modal"; 
import { AddSignatoryModal } from "@/components/add-signatory-modal";
import { ViewSignatoriesModal } from "@/components/view-signatories-modal"; // Import new modal
import { AddReadingPerformerModal } from "@/components/add-reading-performer-modal";
import { ViewReadingPerformersModal } from "@/components/view-reading-performers-modal"; // Import new modal
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, where, getDocs, limit, Timestamp } from "firebase/firestore";
import type { PowerReadingEntry } from "@/types";


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
  const [isViewSignatoriesModalOpen, setIsViewSignatoriesModalOpen] = useState(false); // New state
  const [isAddReadingPerformerModalOpen, setIsAddReadingPerformerModalOpen] = useState(false);
  const [isViewReadingPerformersModalOpen, setIsViewReadingPerformersModalOpen] = useState(false); // New state
  const [userRole, setUserRole] = useState<AppUserRole | null>(null);

  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [selectedClientIdForImport, setSelectedClientIdForImport] = useState<string>("");
  const [isImportingClientReadings, setIsImportingClientReadings] = useState(false);
  const [jsonInputString, setJsonInputString] = useState<string>(""); 

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('pawUserRole') as AppUserRole | null;
      setUserRole(storedRole);
    }

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

  const handleImportPastedJsonReadings = async () => { 
    if (!selectedClientIdForImport) {
      toast({ title: "Client Not Selected", description: "Please select a client to assign these readings to.", variant: "destructive" });
      return;
    }
    if (!jsonInputString.trim()) {
      toast({ title: "No JSON Data", description: "Please paste the JSON data into the text area.", variant: "destructive" });
      return;
    }

    setIsImportingClientReadings(true);

    const selectedClient = clients.find(c => c.id === selectedClientIdForImport);
    if (!selectedClient) {
      toast({ title: "Error", description: "Selected client data not found.", variant: "destructive" });
      setIsImportingClientReadings(false);
      return;
    }

    let parsedJsonData: any;
    try {
      parsedJsonData = JSON.parse(jsonInputString);
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: "The pasted text is not valid JSON. Please check the format.",
        variant: "destructive",
      });
      setIsImportingClientReadings(false);
      return;
    }

    let importedCount = 0;
    let skippedCount = 0;
    const readingsCollection = collection(db, "power-readings");

    const recordsToImport = Object.values(parsedJsonData) as Array<Record<string, string | number>>;

    for (const record of recordsToImport) {
      try {
        const billingMonthYear = (record["BILLING MONTH"] as string).split(" ");
        const billingMonth = billingMonthYear[0];
        const billingYear = parseInt(billingMonthYear[1], 10);

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
        const dateBilled = new Date(billingYear, monthIndex, 1);

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
          notes: "Imported from pasted JSON",
        };

        await addDoc(readingsCollection, {
          ...newReadingEntry,
          createdAt: serverTimestamp(),
        });
        importedCount++;
      } catch (e) {
        console.error("Error importing a JSON record: ", record, e);
        toast({
          title: "Partial Import Error",
          description: `Error importing record for billing month ${record["BILLING MONTH"]}. Check console.`,
          variant: "destructive",
        });
      }
    }

    toast({
      title: "Pasted JSON Import Complete",
      description: `${importedCount} records imported. ${skippedCount} records skipped (duplicates or errors).`,
    });
    setIsImportingClientReadings(false);
    setJsonInputString(""); 
    setSelectedClientIdForImport(""); 
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
            <CardContent className="space-y-6"> 
              <div>
                <h3 className="text-lg font-medium mb-1">Import Historical Mother Bills</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Import historical mother bill data from a predefined JSON structure embedded in the app.
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
                <h3 className="text-lg font-medium mb-1">Import Client Power Readings from JSON</h3>
                 <p className="text-sm text-muted-foreground mb-3">
                  Paste your JSON data below and select a client to assign these readings to.
                  The JSON should be an object where each key is an arbitrary ID and the value is an object with keys:
                  "BILLING MONTH" (e.g., "January 2023"), "Previous" (number), "Present" (number), and "KWH Used" (number).
                </p>
                <div className="space-y-4 max-w-lg"> 
                  <div>
                    <Label htmlFor="paste-json-data">Paste JSON Data Here</Label>
                    <Textarea
                      id="paste-json-data"
                      value={jsonInputString}
                      onChange={(e) => setJsonInputString(e.target.value)}
                      placeholder='{\n  "-ID1": { "BILLING MONTH": "January 2023", "Previous": 100, "Present": 200, "KWH Used": 100 },\n  "-ID2": { "BILLING MONTH": "February 2023", "Previous": 200, "Present": 350, "KWH Used": 150 }\n}'
                      className="mt-1 min-h-[150px] font-mono text-xs" 
                      disabled={isImportingClientReadings}
                    />
                  </div>
                  <div>
                    <Label htmlFor="select-client-for-pasted-import">Assign Readings to Client</Label>
                    <Select
                      value={selectedClientIdForImport}
                      onValueChange={setSelectedClientIdForImport}
                      disabled={isLoadingClients || isImportingClientReadings}
                    >
                      <SelectTrigger id="select-client-for-pasted-import" className="mt-1">
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
                    onClick={handleImportPastedJsonReadings} 
                    disabled={isImportingClientReadings || !selectedClientIdForImport || isLoadingClients || !jsonInputString.trim()}
                    className="w-full"
                  >
                    {isImportingClientReadings ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="mr-2 h-4 w-4" />
                    )}
                    Import Pasted JSON Readings
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
            <div className="flex flex-wrap gap-2 mt-2"> {/* Added mt-2 for spacing */}
              <Button onClick={() => setIsViewSignatoriesModalOpen(true)} variant="ghost">
                <Eye className="mr-2 h-4 w-4" /> View Signatories
              </Button>
              <Button onClick={() => setIsViewReadingPerformersModalOpen(true)} variant="ghost">
                <Eye className="mr-2 h-4 w-4" /> View Reading Performers
              </Button>
            </div>
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
      <ViewSignatoriesModal isOpen={isViewSignatoriesModalOpen} onOpenChange={setIsViewSignatoriesModalOpen} />
      <AddReadingPerformerModal isOpen={isAddReadingPerformerModalOpen} onOpenChange={setIsAddReadingPerformerModalOpen} />
      <ViewReadingPerformersModal isOpen={isViewReadingPerformersModalOpen} onOpenChange={setIsViewReadingPerformersModalOpen} />
    </main>
  );
}
