
"use client";

import type { AppUserRole, ClientDocument, MotherBillEntry, PowerReadingEntry, WaterReadingEntry } from "@/types";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea"; 
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Palette, DatabaseBackup, Loader2, Users, UserPlus, Edit3, UserCog, List, UploadCloud, Eye, UserCheck, Droplet } from "lucide-react";
import { importHistoricalMotherBills } from "@/lib/import-mother-bills";
import { AddUserModal } from "@/components/add-user-modal";
import { ViewUsersModal } from "@/components/view-users-modal"; 
import { AddSignatoryModal } from "@/components/add-signatory-modal";
import { ViewSignatoriesModal } from "@/components/view-signatories-modal";
import { AddReadingPerformerModal } from "@/components/add-reading-performer-modal";
import { ViewReadingPerformersModal } from "@/components/view-reading-performers-modal";
import { AddVerifierModal } from "@/components/add-verifier-modal"; 
import { ViewVerifiersModal } from "@/components/view-verifiers-modal"; 
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, where, getDocs, limit, Timestamp } from "firebase/firestore";


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
  const [isViewSignatoriesModalOpen, setIsViewSignatoriesModalOpen] = useState(false);
  const [isAddReadingPerformerModalOpen, setIsAddReadingPerformerModalOpen] = useState(false);
  const [isViewReadingPerformersModalOpen, setIsViewReadingPerformersModalOpen] = useState(false);
  const [isAddVerifierModalOpen, setIsAddVerifierModalOpen] = useState(false); 
  const [isViewVerifiersModalOpen, setIsViewVerifiersModalOpen] = useState(false); 
  const [userRole, setUserRole] = useState<AppUserRole | null>(null);

  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [selectedClientIdForImport, setSelectedClientIdForImport] = useState<string>("");
  const [isImportingClientReadings, setIsImportingClientReadings] = useState(false);
  const [jsonInputString, setJsonInputString] = useState<string>(""); 
  const [clientImportType, setClientImportType] = useState<'power' | 'water'>('power');

  const [waterJsonInputString, setWaterJsonInputString] = useState<string>("");
  const [isImportingWaterMotherBills, setIsImportingWaterMotherBills] = useState(false);


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

  const handleImportPastedClientReadings = async () => {
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
    let recordsToImport: Array<Record<string, string | number>>;

    const collectionName = clientImportType === 'power' ? 'power-readings' : 'water-readings';
    const readingsCollection = collection(db, collectionName);

    // Logic diverges based on expected JSON format for power vs water
    if (clientImportType === 'power') {
      if (typeof parsedJsonData !== 'object' || parsedJsonData === null || Array.isArray(parsedJsonData)) {
        toast({ title: "Invalid JSON Format", description: "Power readings import expects a JSON object of objects.", variant: "destructive" });
        setIsImportingClientReadings(false);
        return;
      }
      recordsToImport = Object.values(parsedJsonData);
    } else { // water
      if (!Array.isArray(parsedJsonData)) {
        toast({ title: "Invalid JSON Format", description: "Water readings import expects a JSON array of objects.", variant: "destructive" });
        setIsImportingClientReadings(false);
        return;
      }
      recordsToImport = parsedJsonData;
    }

    const consumptionKey = clientImportType === 'power' ? 'KWH Used' : 'M3 (Consumed)';

    for (const record of recordsToImport) {
      try {
        const billingMonthYearString = record["BILLING MONTH"] as string;
        if (!billingMonthYearString || !billingMonthYearString.trim()) {
          console.warn("Skipping record due to empty billing month:", record);
          skippedCount++;
          continue;
        }
        
        const billingMonthYear = billingMonthYearString.split(" ");
        const billingMonth = billingMonthYear[0];
        const billingYear = parseInt(billingMonthYear[1], 10);

        if (!billingMonth || isNaN(billingYear)) {
          console.warn(`Invalid billing period: ${billingMonthYearString}`, record);
          skippedCount++;
          continue;
        }

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
          console.log(`Skipping duplicate for ${selectedClient.clientName}, ${billingMonth} ${billingYear} in ${collectionName}`);
          continue;
        }

        const monthIndex = MONTHS_FOR_PARSING.indexOf(billingMonth);
        if (monthIndex === -1) {
            console.warn(`Invalid month string: ${billingMonth} in record:`, record);
            skippedCount++;
            continue;
        }
        const dateBilled = new Date(billingYear, monthIndex, 1);

        const commonData = {
            clientId: selectedClient.id,
            clientName: selectedClient.clientName,
            stallNo: selectedClient.stallNo,
            dateBilled: Timestamp.fromDate(dateBilled),
            billingMonth: billingMonth,
            billingYear: billingYear,
            previousReading: Number(record.Previous) || 0,
            presentReading: Number(record.Present) || 0,
            notes: "Imported from pasted JSON",
            createdAt: serverTimestamp(),
        };

        if (clientImportType === 'power') {
            const newReadingEntry: Omit<PowerReadingEntry, 'id'> = {
                ...commonData,
                powerMeterNo: selectedClient.powerMeterNo,
                totalKwh: Number(record[consumptionKey]) || 0,
            };
             await addDoc(readingsCollection, newReadingEntry);
        } else { // water
            const newReadingEntry: Omit<WaterReadingEntry, 'id'> = {
                ...commonData,
                waterMeterNo: selectedClient.waterMeterNo,
                totalM3: Number(record[consumptionKey]) || 0,
            };
            await addDoc(readingsCollection, newReadingEntry);
        }
        
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
      description: `${importedCount} ${clientImportType} records imported. ${skippedCount} records skipped (duplicates or errors).`,
    });
    setIsImportingClientReadings(false);
    setJsonInputString(""); 
    setSelectedClientIdForImport(""); 
  };


  const handleImportWaterMotherBills = async () => {
    if (!waterJsonInputString.trim()) {
      toast({ title: "No JSON Data", description: "Please paste the JSON data for water bills.", variant: "destructive" });
      return;
    }
    setIsImportingWaterMotherBills(true);

    let parsedJsonData: any[];
    try {
      parsedJsonData = JSON.parse(waterJsonInputString);
      if (!Array.isArray(parsedJsonData)) {
          throw new Error("JSON data is not an array.");
      }
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: "The pasted text is not a valid JSON array. Please check the format.",
        variant: "destructive",
      });
      setIsImportingWaterMotherBills(false);
      return;
    }
    
    let importedCount = 0;
    let skippedCount = 0;
    const motherBillsCollection = collection(db, "mother-bills");

    for (const record of parsedJsonData) {
        try {
            const billingPeriodString = record["BILLING MONTH"] as string;
            if (!billingPeriodString || !billingPeriodString.trim()) {
                console.warn("Skipping record due to empty billing month:", record);
                skippedCount++;
                continue;
            }

            const billPeriod = billingPeriodString.split(" ");
            const billingMonth = billPeriod[0];
            const billingYear = parseInt(billPeriod[1], 10);
            
            if (!billingMonth || isNaN(billingYear)) {
                console.warn("Skipping record due to invalid billing period:", record);
                skippedCount++;
                continue;
            }

            const totalConsumption = Number(record["M3 CONSUMED"]) || 0;
            const totalAmountBilledStr = String(record[" TOTAL AMOUNT "] || "0").trim().replace("₱", "").replace(/,/g, "");
            const totalAmountBilled = parseFloat(totalAmountBilledStr) || 0;

            const newEntry: Omit<MotherBillEntry, "id" | "createdAt"> & { createdAt: any } = {
                utilityType: 'water',
                billingMonth,
                billingYear,
                pastReading: Number(record["PREVIOUS"]) || 0,
                presentReading: Number(record["PRESENT"]) || 0,
                totalConsumption,
                totalAmountBilled,
                notes: "Imported from pasted JSON (Water)",
                createdAt: serverTimestamp(),
            };

            await addDoc(motherBillsCollection, newEntry);
            importedCount++;
        } catch (e) {
            console.error("Error importing water mother bill record: ", record, e);
            skippedCount++;
        }
    }

    toast({
      title: "Water Bill Import Complete",
      description: `${importedCount} water mother bill records imported. ${skippedCount} records skipped due to errors or missing data.`,
    });
    setWaterJsonInputString("");
    setIsImportingWaterMotherBills(false);
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
                <h3 className="text-lg font-medium mb-1">Import Historical Power Mother Bills</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Import historical power mother bill data from a predefined JSON structure embedded in the app.
                </p>
                <Button onClick={handleImportData} disabled={isImporting}>
                  {isImporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <DatabaseBackup className="mr-2 h-4 w-4" />
                  )}
                  Import Historical Power Bills
                </Button>
              </div>
              <hr className="my-4"/>
              <div>
                 <h3 className="text-lg font-medium mb-1 flex items-center"><Droplet className="h-5 w-5 mr-2 text-primary"/>Import Water Mother Bills from JSON</h3>
                 <p className="text-sm text-muted-foreground mb-3">
                    Paste your JSON array below. Each object in the array should have keys:
                    "BILLING MONTH", "PREVIOUS", "PRESENT", "M3 CONSUMED", and " TOTAL AMOUNT ".
                 </p>
                 <div className="space-y-4 max-w-lg">
                    <Textarea
                      value={waterJsonInputString}
                      onChange={(e) => setWaterJsonInputString(e.target.value)}
                      placeholder='[\n  {\n    "BILLING MONTH": "January 2024",\n    "PRESENT": "13028",\n    "PREVIOUS": "12824",\n    "M3 CONSUMED": "204",\n    " TOTAL AMOUNT ": " ₱16,805.00 "\n  }\n]'
                      className="mt-1 min-h-[150px] font-mono text-xs"
                      disabled={isImportingWaterMotherBills}
                    />
                    <Button
                      onClick={handleImportWaterMotherBills}
                      disabled={isImportingWaterMotherBills || !waterJsonInputString.trim()}
                      className="w-full"
                    >
                      {isImportingWaterMotherBills ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <UploadCloud className="mr-2 h-4 w-4" />
                      )}
                      Import Water Mother Bills
                    </Button>
                 </div>
              </div>
              <hr className="my-4"/>
              <div>
                <h3 className="text-lg font-medium mb-1">Import Client Readings from JSON</h3>
                 <p className="text-sm text-muted-foreground mb-3">
                  Select the utility type, paste your JSON data, and select a client to assign these readings to.
                </p>
                <div className="space-y-4 max-w-lg">
                  <div>
                    <Label>Utility Type</Label>
                    <RadioGroup defaultValue={clientImportType} onValueChange={(value: 'power' | 'water') => setClientImportType(value)} className="flex items-center space-x-4 mt-1">
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="power" id="r-power" />
                          <Label htmlFor="r-power">Power</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="water" id="r-water" />
                          <Label htmlFor="r-water">Water</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="paste-json-data">Paste JSON Data Here</Label>
                    <Textarea
                      id="paste-json-data"
                      value={jsonInputString}
                      onChange={(e) => setJsonInputString(e.target.value)}
                      placeholder={
                        clientImportType === 'power'
                          ? '{\n  "-ID1": { "BILLING MONTH": "January 2023", "Previous": 100, "Present": 200, "KWH Used": 100 },\n  "-ID2": { "BILLING MONTH": "February 2023", "Previous": 200, "Present": 350, "KWH Used": 150 }\n}'
                          : '[\n  {\n    "BILLING MONTH": "May 2025",\n    "Previous": "369",\n    "Present": "389",\n    "M3 (Consumed)": "20"\n  }\n]'
                      }
                      className="mt-1 min-h-[150px] font-mono text-xs" 
                      disabled={isImportingClientReadings}
                    />
                     <p className="text-xs text-muted-foreground mt-1">
                      {clientImportType === 'power'
                        ? 'JSON format must be an object of objects. Keys are "KWH Used", "Previous", "Present", and "BILLING MONTH".'
                        : 'JSON format must be an array of objects. Keys are "M3 (Consumed)", "Previous", "Present", and "BILLING MONTH".'
                      }
                    </p>
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
                    onClick={handleImportPastedClientReadings} 
                    disabled={isImportingClientReadings || !selectedClientIdForImport || isLoadingClients || !jsonInputString.trim()}
                    className="w-full"
                  >
                    {isImportingClientReadings ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="mr-2 h-4 w-4" />
                    )}
                    Import Pasted {clientImportType === 'power' ? 'Power' : 'Water'} Readings
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
              Signatories, Performers & Verifiers
            </CardTitle>
            <CardDescription>Manage personnel involved in billing, readings, and verification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <h4 className="font-medium mb-2">Invoice Signatories</h4>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button onClick={() => setIsAddSignatoryModalOpen(true)} className="flex-1">
                            <UserPlus className="mr-2 h-4 w-4" /> Add 'Prepared by' Signatory
                        </Button>
                        <Button onClick={() => setIsViewSignatoriesModalOpen(true)} variant="outline" className="flex-1">
                            <Eye className="mr-2 h-4 w-4" /> View Signatories
                        </Button>
                    </div>
                </div>
                <div>
                    <h4 className="font-medium mb-2">Reading Performers</h4>
                    <div className="flex flex-col sm:flex-row gap-2">
                         <Button onClick={() => setIsAddReadingPerformerModalOpen(true)} className="flex-1">
                            <UserCog className="mr-2 h-4 w-4" /> Add Reading Performer
                        </Button>
                        <Button onClick={() => setIsViewReadingPerformersModalOpen(true)} variant="outline" className="flex-1">
                            <Eye className="mr-2 h-4 w-4" /> View Performers
                        </Button>
                    </div>
                </div>
            </div>
             <div className="mt-6"> {/* Add some margin-top for separation */}
                <h4 className="font-medium mb-2">'Checked by' Personnel</h4>
                <div className="flex flex-col sm:flex-row gap-2 max-w-md">
                    <Button onClick={() => setIsAddVerifierModalOpen(true)} className="flex-1">
                        <UserCheck className="mr-2 h-4 w-4" /> Add 'Checked by' Personnel
                    </Button>
                    <Button onClick={() => setIsViewVerifiersModalOpen(true)} variant="outline" className="flex-1">
                        <Eye className="mr-2 h-4 w-4" /> View 'Checked by' Personnel
                    </Button>
                </div>
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
      <AddVerifierModal isOpen={isAddVerifierModalOpen} onOpenChange={setIsAddVerifierModalOpen} />
      <ViewVerifiersModal isOpen={isViewVerifiersModalOpen} onOpenChange={setIsViewVerifiersModalOpen} />
    </main>
  );
}
