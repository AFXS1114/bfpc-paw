
"use client";

import { useState, useEffect } from "react";
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
import type { ClientDocument, PowerReadingDocument, MotherBillDocument, InvoiceData, SignatoryDocument, ReadingPerformerDocument, VerifierDocument, InvoiceRecordEntry } from "@/types";
import { FileText, Search, Loader2, Download, UserCog, UserCheck, Edit3 } from "lucide-react";
import { format } from "date-fns";

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

if (pdfFonts && (pdfFonts as any).pdfMake && (pdfFonts as any).pdfMake.vfs) {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
} else if (pdfFonts && (pdfFonts as any).default && (pdfFonts as any).default.pdfMake && (pdfFonts as any).default.pdfMake.vfs) {
  (pdfMake as any).vfs = (pdfFonts as any).default.pdfMake.vfs;
} else if (pdfFonts && typeof pdfFonts === 'object' && Object.keys(pdfFonts).length > 0 && !(pdfFonts as any).pdfMake) {
    (pdfMake as any).vfs = pdfFonts;
    if (!((pdfMake as any).vfs && Object.keys((pdfMake as any).vfs).length > 0)) {
        (pdfMake as any).vfs = undefined; 
    }
} else {
  console.error("Failed to load pdfMake VFS fonts on Invoicing page. Structure of 'pdfFonts':", JSON.stringify(pdfFonts, null, 2));
}


const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

async function imageToDataUrl(src: string): Promise<string | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status} ${response.statusText} for src: ${src}`);
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to data URL:", error);
    return null;
  }
}

export default function InvoicingPage() {
  const { toast } = useToast();
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
  const [selectedSignatoryId, setSelectedSignatoryId] = useState<string>(""); // For "Prepared By"
  const [selectedVerifierId, setSelectedVerifierId] = useState<string>("");

  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Fetch clients
  useEffect(() => {
    setIsLoadingClients(true);
    const unsub = onSnapshot(query(collection(db, "clients"), orderBy("clientName", "asc")), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientDocument)));
      setIsLoadingClients(false);
    }, (err) => { console.error("Err clients:", err); toast({ title: "Error", description: "Failed to fetch clients."}); setIsLoadingClients(false); });
    return () => unsub();
  }, [toast]);

  // Fetch reading performers
  useEffect(() => {
    setIsLoadingReadingPerformers(true);
    const unsub = onSnapshot(query(collection(db, "reading-performers"), orderBy("name", "asc")), (snap) => {
      setReadingPerformers(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReadingPerformerDocument)));
      setIsLoadingReadingPerformers(false);
    }, (err) => { console.error("Err performers:", err); toast({ title: "Error", description: "Failed to fetch reading performers."}); setIsLoadingReadingPerformers(false); });
    return () => unsub();
  }, [toast]);

  // Fetch signatories (for "Prepared By")
  useEffect(() => {
    setIsLoadingSignatories(true);
    const unsub = onSnapshot(query(collection(db, "signatories"), orderBy("name", "asc")), (snap) => {
      setSignatories(snap.docs.map(d => ({ id: d.id, ...d.data() } as SignatoryDocument)));
      setIsLoadingSignatories(false);
    }, (err) => { console.error("Err signatories:", err); toast({ title: "Error", description: "Failed to fetch signatories."}); setIsLoadingSignatories(false); });
    return () => unsub();
  }, [toast]);

  // Fetch verifiers
  useEffect(() => {
    setIsLoadingVerifiers(true);
    const unsub = onSnapshot(query(collection(db, "verifiers"), orderBy("name", "asc")), (snap) => {
      setVerifiers(snap.docs.map(d => ({ id: d.id, ...d.data() } as VerifierDocument)));
      setIsLoadingVerifiers(false);
    }, (err) => { console.error("Err verifiers:", err); toast({ title: "Error", description: "Failed to fetch verifiers."}); setIsLoadingVerifiers(false); });
    return () => unsub();
  }, [toast]);


  const handleGenerateInvoicePreview = async () => {
    if (!selectedClientId || !selectedBillingMonth || !selectedBillingYear || !selectedReadingPerformerId || !selectedSignatoryId || !selectedVerifierId) {
      toast({ title: "Missing Information", description: "Please select a client, billing period, reading performer, preparer (signatory), and verifier.", variant: "destructive" });
      return;
    }
    setIsGeneratingPreview(true);
    setInvoiceData(null); 

    try {
      const client = clients.find(c => c.id === selectedClientId);
      if (!client) {
        toast({ title: "Client Not Found", description: "Selected client data could not be found.", variant: "destructive" });
        setIsGeneratingPreview(false);
        return;
      }

      const powerReadingQuery = query(
        collection(db, "power-readings"),
        where("clientId", "==", selectedClientId),
        where("billingMonth", "==", selectedBillingMonth),
        where("billingYear", "==", parseInt(selectedBillingYear, 10)),
        limit(1)
      );
      const powerReadingSnapshot = await getDocs(powerReadingQuery);

      if (powerReadingSnapshot.empty) {
        toast({ title: "Power Reading Not Found", variant: "destructive" });
        setIsGeneratingPreview(false); return;
      }
      const powerReadingDoc = powerReadingSnapshot.docs[0].data() as PowerReadingDocument;

      const motherBillQuery = query(
        collection(db, "mother-bills"),
        where("utilityType", "==", "power"),
        where("billingMonth", "==", selectedBillingMonth),
        where("billingYear", "==", parseInt(selectedBillingYear, 10)),
        limit(1)
      );
      const motherBillSnapshot = await getDocs(motherBillQuery);

      if (motherBillSnapshot.empty) {
        toast({ title: "Mother Bill Not Found", variant: "destructive" });
        setIsGeneratingPreview(false); return;
      }
      const motherBill = motherBillSnapshot.docs[0].data() as MotherBillDocument;

      if (motherBill.totalConsumption === 0) {
        toast({ title: "Invalid Mother Bill Data", variant: "destructive" });
        setIsGeneratingPreview(false); return;
      }
      
      const basicRate = motherBill.totalAmountBilled / motherBill.totalConsumption;
      const amountBeforeVAT = basicRate * powerReadingDoc.totalKwh;
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
        billingYear: parseInt(selectedBillingYear, 10),
        clientPreviousReading: powerReadingDoc.previousReading,
        clientPresentReading: powerReadingDoc.presentReading,
        clientTotalKwh: powerReadingDoc.totalKwh,
        motherBillTotalAmount: motherBill.totalAmountBilled,
        motherBillTotalConsumption: motherBill.totalConsumption,
        basicRate: basicRate,
        amountBeforeVAT: amountBeforeVAT,
        vatAmount: vatAmount,
        totalAmountDue: totalAmountDue,
        invoiceNumber: `${client.stallNo.replace(/[^A-Z0-9]/ig, '')}-${selectedBillingYear}${MONTHS.indexOf(selectedBillingMonth).toString().padStart(2, '0')}`,
        invoiceDate: format(currentDate, "MMMM dd, yyyy"),
        companyName: "BULAN FISH PORT COMPLEX",
        companyAddressLine1: "Pier 2, Zone-4, Bulan, Sorsogon",
        companyAddressLine2: "", 
        paymentInstructions: "Please make all checks payable to BULAN FISH PORT COMPLEX.\nPayment can be made at the administration office.",
        readingPerformerName: performer?.name,
        readingPerformerPosition: performer?.position,
        signatoryName: signatory?.name, // This is "Prepared By"
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
    if (!(pdfMake as any).vfs) {
      toast({ title: "PDF Fonts Not Loaded", variant: "destructive" }); return;
    }
    setIsExportingPdf(true);

    const logoDataUrl = await imageToDataUrl('/company-logo.png');
    const data = invoiceData;

    const formatCurrency = (amount: number) => `P${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const generateInvoiceContent = (invoiceCopyData: InvoiceData, copyTitle: string) => {
      const companyHeaderInfo: any[] = [];
      if (logoDataUrl) {
          companyHeaderInfo.push({ image: logoDataUrl, width: 50, alignment: 'left' as const, margin: [0, 0, 0, 2] as const });
      }
      companyHeaderInfo.push(
          { text: invoiceCopyData.companyName, style: 'header', alignment: 'left' as const, margin: [0,0,0,0] as const},
          { text: invoiceCopyData.companyAddressLine1, style: 'address', alignment: 'left' as const, margin: [0,0,0,0] as const}
      );
      if (invoiceCopyData.companyAddressLine2) {
          companyHeaderInfo.push({ text: invoiceCopyData.companyAddressLine2, style: 'address', alignment: 'left' as const, margin: [0,0,0,1] as const });
      }
      
      return [
        { columns: [ companyHeaderInfo, [ { text: `INVOICE (${copyTitle})`, style: 'invoiceTitle', alignment: 'right' as const }, { text: `Invoice #: ${invoiceCopyData.invoiceNumber}`, alignment: 'right' as const, style: 'small' }, { text: `Date: ${invoiceCopyData.invoiceDate}`, alignment: 'right' as const, style: 'small' }, ] ], columnGap: 10, },
        { canvas: [{ type: 'line' as const, x1: 0, y1: 3, x2: 515, y2: 3, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 3, 0, 5] as const },
        { columns: [ [ { text: 'Bill To:', style: 'subheader' }, { text: invoiceCopyData.clientName, style: 'defaultCompact' }, { text: `Stall No: ${invoiceCopyData.stallNo}`, style: 'defaultCompact' }, ], [ { text: 'Billing Period:', style: 'subheader', alignment: 'right' as const }, { text: `${invoiceCopyData.billingMonth} ${invoiceCopyData.billingYear}`, alignment: 'right' as const, style: 'defaultCompact' }, ] ], columnGap: 10, margin: [0, 0, 0, 5] as const, },
        { style: 'itemsTable', table: { widths: ['*', 50, 50, 50, 60, 65], body: [ [ { text: 'Description', style: 'tableHeader' }, { text: 'Prev.\n(kWh)', style: 'tableHeader', alignment: 'right' as const }, { text: 'Pres.\n(kWh)', style: 'tableHeader', alignment: 'right' as const }, { text: 'Cons.\n(kWh)', style: 'tableHeader', alignment: 'right' as const }, { text: 'Rate\n(P/kWh)', style: 'tableHeader', alignment: 'right' as const }, { text: 'Amount\n(P)', style: 'tableHeader', alignment: 'right' as const }, ], [ 'Power Consumption', { text: invoiceCopyData.clientPreviousReading?.toLocaleString() ?? 'N/A', alignment: 'right' as const }, { text: invoiceCopyData.clientPresentReading?.toLocaleString() ?? 'N/A', alignment: 'right' as const }, { text: invoiceCopyData.clientTotalKwh?.toLocaleString() ?? 'N/A', alignment: 'right' as const, bold: true }, { text: `P${(invoiceCopyData.basicRate ?? 0).toFixed(4)}`, alignment: 'right' as const }, { text: formatCurrency((invoiceCopyData.clientTotalKwh ?? 0) * (invoiceCopyData.basicRate ?? 0)), alignment: 'right' as const }, ] ] }, layout: { hLineWidth: function (i: number, node: any) { return (i === 0 || i === node.table.body.length) ? 0.5 : 0.5; }, vLineWidth: function (i: number, node: any) { return 0.5; }, hLineColor: function (i: number, node: any) { return '#BFBFBF'; }, vLineColor: function (i: number, node: any) { return '#BFBFBF'; }, paddingLeft: function(i: number, node: any) { return 3; }, paddingRight: function(i: number, node: any) { return 3; }, paddingTop: function(i: number, node: any) { return 1; }, paddingBottom: function(i: number, node: any) { return 1; } } },
        { margin: [0, 2, 0, 2] as const, table: { widths: ['*'], body: [ [ { text: [ { text: 'Rate Basis (MB ', style: 'smallHeader' }, { text: `${invoiceCopyData.billingMonth} ${invoiceCopyData.billingYear}):`, style: 'smallHeader', bold: true }, { text: ` MB Amt: ${formatCurrency(invoiceCopyData.motherBillTotalAmount ?? 0)} | MB Cons: ${(invoiceCopyData.motherBillTotalConsumption ?? 0).toLocaleString()} kWh`, style: 'small' } ], fillColor: '#F5F5F5', border: [true, true, true, true] as const, borderColor: ['#E0E0E0', '#E0E0E0', '#E0E0E0', '#E0E0E0'] as const, margin: [0, 1] as const, } ] ] }, layout: 'noBorders' },
        { columns: [ { width: '*', text: '' }, { width: 'auto', style: 'summaryTable', table: { widths: ['auto', 'auto'], body: [ ['Subtotal:', { text: formatCurrency(invoiceCopyData.amountBeforeVAT), alignment: 'right' as const }], ['VAT (12%):', { text: formatCurrency(invoiceCopyData.vatAmount), alignment: 'right' as const }], [{ text: 'Total Amount Due:', bold: true, style:'totalAmountKey' }, { text: formatCurrency(invoiceCopyData.totalAmountDue), alignment: 'right' as const, bold: true, style:'totalAmountValue' }] ] }, layout: 'noBorders' } ], margin: [0, 2, 0, 5] as const },
        { text: '', margin: [0,0,0,5] as const}, 
        invoiceCopyData.paymentInstructions ? { text: 'Payment Instructions:', style: 'subheader', margin: [0, 2, 0, 1] as const } : {text:''}, 
        invoiceCopyData.paymentInstructions ? { text: invoiceCopyData.paymentInstructions, style: 'defaultCompact', margin: [0, 0, 0, 5] as const } : {text:''}, 
        {
            columns: [
                (invoiceCopyData.readingPerformerName || invoiceCopyData.readingPerformerPosition) ? [
                    { text: 'Readings Performed by:', style: 'small', margin: [0, 0, 0, 15] as const }, 
                    { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }], margin: [0,0,0,1] as const},
                    { text: invoiceCopyData.readingPerformerName || '', style: 'defaultCompact', bold: true },
                    { text: invoiceCopyData.readingPerformerPosition || '', style: 'small' },
                ] : {text: ''},
                (invoiceCopyData.signatoryName || invoiceCopyData.signatoryPosition) ? [ 
                    { text: 'Prepared by:', style: 'small', margin: [0, 0, 0, 15] as const },
                    { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }], margin: [0,0,0,1] as const},
                    { text: invoiceCopyData.signatoryName || '', style: 'defaultCompact', bold: true },
                    { text: invoiceCopyData.signatoryPosition || '', style: 'small' },
                ] : {text: ''},
                (invoiceCopyData.verifierName || invoiceCopyData.verifierDesignation) ? [ 
                    { text: 'Checked and Verified by:', style: 'small', margin: [0, 0, 0, 15] as const },
                    { canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }], margin: [0,0,0,1] as const},
                    { text: invoiceCopyData.verifierName || '', style: 'defaultCompact', bold: true },
                    { text: invoiceCopyData.verifierDesignation || '', style: 'small' },
                ] : {text: ''}
            ],
            columnGap: 10, 
            margin: [0, 10, 0, 0] as const,
        },
        { text: 'Received by: _________________________', style: 'defaultCompact', alignment: 'left' as const, margin: [0, 20, 0, 0] as const }
      ];
    };
    
    const documentDefinition: any = {
      content: [ ...generateInvoiceContent(data, "Client's Copy"), { text: ' ', margin: [0, 10, 0, 10] }, { canvas: [{ type: 'line', x1: 5, y1: 5, x2: 590-5, y2: 5, dash: { length: 5, space: 2 }, lineColor: '#aaaaaa' }], margin: [0, 0, 0, 10] }, { text: ' ', margin: [0, 10, 0, 10] }, ...generateInvoiceContent(data, "Office Copy") ],
      defaultStyle: { fontSize: 7.5, lineHeight: 1.0, font: "Roboto" },
      styles: { header: { fontSize: 10, bold: true, margin: [0, 0, 0, 1], color: '#333333' }, address: { fontSize: 6.5, margin: [0,0,0,1], color: '#4A4A4A'}, invoiceTitle: { fontSize: 14, bold: true, color: '#1E40AF', margin: [0, 0, 0, 1] }, subheader: { fontSize: 7.5, bold: true, margin: [0, 1, 0, 1], color: '#333333' }, itemsTable: { margin: [0, 2, 0, 2], fontSize: 6.5 }, tableHeader: { bold: true, fontSize: 6.5, color: '#1F2937'}, summaryTable: { margin: [0,0,0,2], fontSize: 7}, totalAmountKey: {fontSize: 7.5, bold:true, color: '#1E40AF'}, totalAmountValue: {fontSize: 7.5, bold:true, color: '#1E40AF'}, smallHeader: { fontSize: 6, color: '#4A4A4A'}, small: { fontSize: 6, color: '#4A4A4A'}, defaultCompact: {fontSize: 7, color: '#333333'} },
      pageSize: 'A4', pageOrientation: 'portrait', pageMargins: [25, 25, 25, 25], footer: function(currentPage: number, pageCount: number) { return { text: `Page ${currentPage.toString()} of ${pageCount.toString()}`, alignment: 'center' as const, style: 'small', margin: [0,0,0,10] as const }; }
    };
    
    try {
      pdfMake.createPdf(documentDefinition).download(`Invoice-${invoiceData.invoiceNumber}.pdf`);
      
      // Save invoice record to Firestore
      const clientDoc = clients.find(c => c.id === selectedClientId);
      if (clientDoc) {
        const invoiceRecord: Omit<InvoiceRecordEntry, 'id' | 'createdAt' | 'invoiceDate' | 'paidAt'> & { createdAt: any, invoiceDate: any, paidAt?: any } = {
            invoiceNumber: invoiceData.invoiceNumber,
            invoiceType: 'single',
            clientId: clientDoc.id,
            clientName: clientDoc.clientName,
            stallNo: clientDoc.stallNo,
            invoiceDate: serverTimestamp(), // Date PDF was generated/saved
            displayInvoiceDate: invoiceData.invoiceDate, // Date shown on PDF
            billingPeriodDescription: `Power - ${invoiceData.billingMonth} ${invoiceData.billingYear}`,
            totalAmountDue: invoiceData.totalAmountDue,
            status: 'unpaid',
            createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, "invoices"), invoiceRecord);
        toast({ title: "PDF Exported & Invoice Saved", description: `Invoice ${invoiceData.invoiceNumber} saved to records.` });
      } else {
        toast({ title: "PDF Exported (Record Not Saved)", description: "Client details missing for saving record.", variant: "destructive"});
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
      <PageHeader title="Create Invoice" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Search className="h-6 w-6 text-primary" />Select Invoice Parameters</CardTitle>
            <CardDescription>Choose client, period, and personnel for the invoice.</CardDescription>
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
                    <p><strong>Total kWh:</strong> {invoiceData.clientTotalKwh?.toLocaleString() ?? 'N/A'}</p>
                    <p><strong>Total Amount Due:</strong> P{invoiceData.totalAmountDue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
