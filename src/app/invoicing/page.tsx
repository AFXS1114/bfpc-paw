
"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, getDocs, limit, Timestamp, addDoc, serverTimestamp } from "firebase/firestore";
import type { ClientDocument, PowerReadingDocument, WaterReadingDocument, MotherBillDocument, InvoiceData, SignatoryDocument, ReadingPerformerDocument, VerifierDocument, InvoiceRecordEntry, UtilityType, MonthlyRateDocument } from "@/types";
import { FileText, Search, Loader2, Download, UserCog, UserCheck, Edit3, Zap, Droplet } from "lucide-react";
import { format } from "date-fns";
import { useModule } from "@/context/module-context";
import { generatePdf } from "@/lib/invoice-helpers";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export default function InvoicingPage() {
  const { toast } = useToast();
  const { selectedModule } = useModule();

  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  
  const [readingPerformers, setReadingPerformers] = useState<ReadingPerformerDocument[]>([]);
  const [isLoadingReadingPerformers, setIsLoadingReadingPerformers] = useState(true);
  const [signatories, setSignatories] = useState<SignatoryDocument[]>([]);
  const [isLoadingSignatories, setIsLoadingSignatories] = useState(true);
  const [verifiers, setVerifiers] = useState<VerifierDocument[]>([]);
  const [isLoadingVerifiers, setIsLoadingVerifiers] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedBillingMonth, setSelectedBillingMonth] = useState<string>(MONTHS[new Date().getMonth()]);
  const [selectedBillingYear, setSelectedBillingYear] = useState<string>(currentYear.toString());
  const [selectedReadingPerformerId, setSelectedReadingPerformerId] = useState<string>("");
  const [selectedSignatoryId, setSelectedSignatoryId] = useState<string>("");
  const [selectedVerifierId, setSelectedVerifierId] = useState<string>("");

  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const utilityConfig = useMemo(() => {
    if (selectedModule === 'water') {
      return {
        utilityType: 'water' as UtilityType,
        pageTitle: 'Create Water Invoice',
        readingsCollection: 'water-readings',
        consumptionUnit: 'm³' as 'm³',
        consumptionField: 'totalM3',
        invoiceDesc: 'water',
        icon: <Droplet className="h-6 w-6 text-primary" />,
      };
    }
    return {
      utilityType: 'power' as UtilityType,
      pageTitle: 'Create Power Invoice',
      readingsCollection: 'power-readings',
      consumptionUnit: 'kWh' as 'kWh',
      consumptionField: 'totalKwh',
      invoiceDesc: 'power',
      icon: <Zap className="h-6 w-6 text-primary" />,
    };
  }, [selectedModule]);

  // Fetch clients, performers, signatories, verifiers
  useEffect(() => {
    const unsubClients = onSnapshot(query(collection(db, "clients"), orderBy("clientName", "asc")), snap => { setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientDocument))); setIsLoadingClients(false); }, err => { console.error("Err clients:", err); toast({ title: "Error", description: "Failed to fetch clients." }); setIsLoadingClients(false); });
    const unsubPerformers = onSnapshot(query(collection(db, "reading-performers"), orderBy("name", "asc")), snap => { setReadingPerformers(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReadingPerformerDocument))); setIsLoadingReadingPerformers(false); }, err => { console.error("Err performers:", err); toast({ title: "Error", description: "Failed to fetch reading performers." }); setIsLoadingReadingPerformers(false); });
    const unsubSignatories = onSnapshot(query(collection(db, "signatories"), orderBy("name", "asc")), snap => { setSignatories(snap.docs.map(d => ({ id: d.id, ...d.data() } as SignatoryDocument))); setIsLoadingSignatories(false); }, err => { console.error("Err signatories:", err); toast({ title: "Error", description: "Failed to fetch signatories." }); setIsLoadingSignatories(false); });
    const unsubVerifiers = onSnapshot(query(collection(db, "verifiers"), orderBy("name", "asc")), snap => { setVerifiers(snap.docs.map(d => ({ id: d.id, ...d.data() } as VerifierDocument))); setIsLoadingVerifiers(false); }, err => { console.error("Err verifiers:", err); toast({ title: "Error", description: "Failed to fetch verifiers." }); setIsLoadingVerifiers(false); });
    return () => { unsubClients(); unsubPerformers(); unsubSignatories(); unsubVerifiers(); };
  }, [toast]);

  const handleGenerateInvoicePreview = async () => {
    if (!selectedClientId || !selectedBillingMonth || !selectedBillingYear || !selectedReadingPerformerId || !selectedSignatoryId || !selectedVerifierId) {
      toast({ title: "Missing Information", description: "Please select all required fields.", variant: "destructive" });
      return;
    }
    setIsGeneratingPreview(true);
    setInvoiceData(null); 

    try {
      const client = clients.find(c => c.id === selectedClientId);
      if (!client) {
        toast({ title: "Client Not Found", variant: "destructive" });
        setIsGeneratingPreview(false);
        return;
      }

      const yearInt = parseInt(selectedBillingYear, 10);

      const readingQuery = query(
        collection(db, utilityConfig.readingsCollection),
        where("clientId", "==", selectedClientId),
        where("billingMonth", "==", selectedBillingMonth),
        where("billingYear", "==", yearInt),
        limit(1)
      );
      const readingSnapshot = await getDocs(readingQuery);

      if (readingSnapshot.empty) {
        toast({ title: `${utilityConfig.utilityType.toUpperCase()} Reading Not Found`, variant: "destructive" });
        setIsGeneratingPreview(false); return;
      }
      const readingDoc = readingSnapshot.docs[0].data() as PowerReadingDocument | WaterReadingDocument;

      // 1. Check for manual rate first
      let basicRate = 0;
      let motherBillTotalAmount = 0;
      let motherBillTotalConsumption = 0;

      const manualRateQuery = query(
        collection(db, "monthly-rates"),
        where("utilityType", "==", utilityConfig.utilityType),
        where("billingMonth", "==", selectedBillingMonth),
        where("billingYear", "==", yearInt),
        limit(1)
      );
      const manualRateSnapshot = await getDocs(manualRateQuery);

      if (!manualRateSnapshot.empty) {
        const manualRateDoc = manualRateSnapshot.docs[0].data() as MonthlyRateDocument;
        basicRate = manualRateDoc.rate;
        console.log("Using manual rate override:", basicRate);
      } else {
        // 2. Fallback to mother bill
        const motherBillQuery = query(
          collection(db, "mother-bills"),
          where("utilityType", "==", utilityConfig.utilityType),
          where("billingMonth", "==", selectedBillingMonth),
          where("billingYear", "==", yearInt),
          limit(1)
        );
        const motherBillSnapshot = await getDocs(motherBillQuery);

        if (motherBillSnapshot.empty) {
          toast({ title: "Rate Calculation Error", description: "No manual rate or mother bill found for this period.", variant: "destructive" });
          setIsGeneratingPreview(false); return;
        }
        const motherBill = motherBillSnapshot.docs[0].data() as MotherBillDocument;
        motherBillTotalAmount = motherBill.totalAmountBilled;
        motherBillTotalConsumption = motherBill.totalConsumption;

        if (motherBill.totalConsumption === 0) {
          toast({ title: "Invalid Mother Bill Data", description: "Mother bill consumption is zero.", variant: "destructive" });
          setIsGeneratingPreview(false); return;
        }
        basicRate = motherBill.totalAmountBilled / motherBill.totalConsumption;
      }
      
      const consumptionValue = (readingDoc as any)[utilityConfig.consumptionField] as number;
      const amountBeforeVAT = basicRate * consumptionValue;
      const vatAmount = amountBeforeVAT * 0.12; 
      const totalAmountDue = amountBeforeVAT + vatAmount;

      const performer = readingPerformers.find(p => p.id === selectedReadingPerformerId);
      const signatory = signatories.find(s => s.id === selectedSignatoryId);
      const verifier = verifiers.find(v => v.id === selectedVerifierId);

      const currentDate = new Date();
      const generatedInvoiceData: InvoiceData = {
        clientName: client.clientName,
        stallNo: client.stallNo,
        billingMonth: selectedBillingMonth,
        billingYear: yearInt,
        
        clientPreviousReading: readingDoc.previousReading,
        clientPresentReading: readingDoc.presentReading,
        clientTotalKwh: utilityConfig.utilityType === 'power' ? consumptionValue : undefined,
        clientTotalM3: utilityConfig.utilityType === 'water' ? consumptionValue : undefined,
        consumptionUnit: utilityConfig.consumptionUnit,

        motherBillTotalAmount: motherBillTotalAmount > 0 ? motherBillTotalAmount : undefined,
        motherBillTotalConsumption: motherBillTotalConsumption > 0 ? motherBillTotalConsumption : undefined,
        basicRate: basicRate,
        amountBeforeVAT: amountBeforeVAT,
        vatAmount: vatAmount,
        totalAmountDue: totalAmountDue,
        
        invoiceNumber: `${client.stallNo.replace(/[^A-Z0-9]/ig, '')}-${utilityConfig.utilityType.toUpperCase()}-${selectedBillingYear}${MONTHS.indexOf(selectedBillingMonth).toString().padStart(2, '0')}`,
        invoiceDate: format(currentDate, "MMMM dd, yyyy"),
        
        companyName: "BULAN FISH PORT COMPLEX",
        companyAddressLine1: "Pier 2, Zone-4, Bulan, Sorsogon",
        paymentInstructions: "Please make all checks payable to BULAN FISH PORT COMPLEX.\nPayment can be made at the administration office.",
        
        readingPerformerName: performer?.name,
        readingPerformerPosition: performer?.position,
        signatoryName: signatory?.name,
        signatoryPosition: signatory?.position,
        verifierName: verifier?.name,
        verifierDesignation: verifier?.designation,
      };
      setInvoiceData(generatedInvoiceData);
      toast({ title: "Invoice Data Ready" });

    } catch (error) {
      console.error("Error generating invoice data: ", error);
      toast({ title: "Data Preparation Failed", variant: "destructive" });
    } finally {
      setIsGeneratingPreview(false);
    }
  };


  const handleExportToPdf = async () => {
    if (!invoiceData) {
      toast({ title: "No Invoice Data", variant: "destructive" }); return;
    }
    setIsExportingPdf(true);
    
    try {
      await generatePdf(invoiceData, 'single');
      
      const clientDoc = clients.find(c => c.id === selectedClientId);
      if (clientDoc) {
        const invoiceRecord: Omit<InvoiceRecordEntry, 'id' | 'createdAt' | 'invoiceDate' | 'paidAt'> & { createdAt: any, invoiceDate: any, paidAt?: any } = {
            invoiceNumber: invoiceData.invoiceNumber,
            invoiceType: 'single',
            utilityType: utilityConfig.utilityType,
            clientId: clientDoc.id,
            clientName: clientDoc.clientName,
            stallNo: clientDoc.stallNo,
            invoiceDate: serverTimestamp(),
            displayInvoiceDate: invoiceData.invoiceDate,
            billingPeriodDescription: `${utilityConfig.utilityType.charAt(0).toUpperCase() + utilityConfig.utilityType.slice(1)} - ${invoiceData.billingMonth} ${invoiceData.billingYear}`,
            totalAmountDue: invoiceData.totalAmountDue,
            status: 'unpaid',
            regenerationData: invoiceData, // Save the complete data for redownload
            createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, "invoices"), invoiceRecord);
        toast({ title: "PDF Exported & Invoice Saved", description: `Invoice ${invoiceData.invoiceNumber} saved to records.` });
      } else {
        toast({ title: "PDF Exported (Record Not Saved)", variant: "destructive"});
      }

    } catch(e) {
      console.error("Error PDF export or saving invoice: ", e);
      toast({ title: "PDF Export Failed", description: (e as Error).message || "Could not export PDF or save invoice record.", variant: "destructive"});
    } finally {
      setIsExportingPdf(false);
    }
  };

  const isLoadingAnyPersonnel = isLoadingReadingPerformers || isLoadingSignatories || isLoadingVerifiers;
  const isGenerateButtonDisabled = isGeneratingPreview || isLoadingClients || isLoadingAnyPersonnel || 
                                   !selectedClientId || !selectedBillingMonth || !selectedBillingYear ||
                                   !selectedReadingPerformerId || !selectedSignatoryId || !selectedVerifierId;


  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title={utilityConfig.pageTitle} />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                {utilityConfig.icon}
                Select Invoice Parameters
            </CardTitle>
            <CardDescription>Choose client, period, and personnel for the {utilityConfig.invoiceDesc} invoice.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="select-client">Client Name</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId} disabled={isLoadingClients}>
                  <SelectTrigger id="select-client" className="mt-1"><SelectValue placeholder={isLoadingClients ? "Loading..." : "Select client"} /></SelectTrigger>
                  <SelectContent>{clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.clientName} ({c.stallNo})</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="select-billing-month">Billing Month</Label>
                <Select value={selectedBillingMonth} onValueChange={setSelectedBillingMonth}>
                  <SelectTrigger id="select-billing-month" className="mt-1"><SelectValue placeholder="Select month" /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="select-billing-year">Billing Year</Label>
                 <Select value={selectedBillingYear} onValueChange={setSelectedBillingYear}>
                  <SelectTrigger id="select-billing-year" className="mt-1"><SelectValue placeholder="Select year" /></SelectTrigger>
                  <SelectContent>{YEARS.map((y) => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div>
                <Label htmlFor="select-performer" className="flex items-center"><UserCog className="h-4 w-4 mr-1 text-primary/80" />Reading Performer</Label>
                <Select value={selectedReadingPerformerId} onValueChange={setSelectedReadingPerformerId} disabled={isLoadingReadingPerformers}>
                  <SelectTrigger id="select-performer" className="mt-1"><SelectValue placeholder={isLoadingReadingPerformers ? "Loading..." : "Select performer"} /></SelectTrigger>
                  <SelectContent>{readingPerformers.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.position})</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="select-signatory" className="flex items-center"><Edit3 className="h-4 w-4 mr-1 text-primary/80" />Prepared By (Signatory)</Label>
                <Select value={selectedSignatoryId} onValueChange={setSelectedSignatoryId} disabled={isLoadingSignatories}>
                  <SelectTrigger id="select-signatory" className="mt-1"><SelectValue placeholder={isLoadingSignatories ? "Loading..." : "Select signatory"} /></SelectTrigger>
                  <SelectContent>{signatories.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name} ({s.position})</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="select-verifier" className="flex items-center"><UserCheck className="h-4 w-4 mr-1 text-primary/80" />Checked & Verified By</Label>
                <Select value={selectedVerifierId} onValueChange={setSelectedVerifierId} disabled={isLoadingVerifiers}>
                  <SelectTrigger id="select-verifier" className="mt-1"><SelectValue placeholder={isLoadingVerifiers ? "Loading..." : "Select verifier"} /></SelectTrigger>
                  <SelectContent>{verifiers.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name} ({v.designation})</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleGenerateInvoicePreview} disabled={isGenerateButtonDisabled}>
              {isGeneratingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Generate Invoice Data
            </Button>
          </CardContent>
        </Card>

        {isGeneratingPreview && (
            <Card className="shadow-lg mt-6"><CardHeader><CardTitle>Preparing Invoice Data...</CardTitle></CardHeader><CardContent className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></CardContent></Card>
        )}

        {invoiceData && !isGeneratingPreview && (
          <Card className="shadow-lg mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Invoice Data Ready</CardTitle><CardDescription>Invoice data for {invoiceData.clientName} ({invoiceData.billingMonth} {invoiceData.billingYear}) is ready. Click to export.</CardDescription></div>
              <Button onClick={handleExportToPdf} disabled={isExportingPdf}>{isExportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Export to PDF & Save</Button>
            </CardHeader>
            <CardContent className="p-2 bg-muted/30 overflow-x-auto">
                <p className="text-sm text-muted-foreground">The detailed HTML preview has been removed. Click "Export to PDF & Save" to generate the document and save the record.</p>
                <div className="mt-4 p-4 border rounded-md bg-background text-xs">
                    <h4 className="font-semibold mb-2">Quick Data Summary:</h4>
                    <p><strong>Client:</strong> {invoiceData.clientName} ({invoiceData.stallNo})</p>
                    <p><strong>Period:</strong> {invoiceData.billingMonth} {invoiceData.billingYear}</p>
                    <p><strong>Total {invoiceData.consumptionUnit}:</strong> {(invoiceData.clientTotalKwh ?? invoiceData.clientTotalM3)?.toLocaleString() ?? 'N/A'}</p>
                    <p><strong>Multiplier Rate:</strong> P{invoiceData.basicRate.toFixed(4)}</p>
                    <p><strong>Total Amount Due:</strong> P{invoiceData.totalAmountDue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
