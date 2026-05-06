
"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, Timestamp, where, getDocs, writeBatch, limit } from "firebase/firestore";
import type { InvoiceRecordDocument, ClientDocument, UtilityType } from "@/types";
import { MarkAsPaidModal } from "@/components/mark-as-paid-modal";
import { format } from "date-fns";
import { Archive, CheckCircle, Clock, FileText, DollarSign, Download, Loader2, ListFilter, XCircle, Eye } from "lucide-react";
import { generatePdf } from "@/lib/invoice-helpers";

const MONTHS_ARRAY = [ 
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function InvoicesPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceRecordDocument[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  // Filter states
  const [utilityTypeFilter, setUtilityTypeFilter] = useState<"all" | UtilityType>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [amountSearch, setAmountSearch] = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecordDocument | null>(null);
  const [isRedownloadingId, setIsRedownloadingId] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isPreviewLoadingId, setIsPreviewLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoadingInvoices(true);
    const invoicesQuery = query(collection(db, "invoices"), orderBy("invoiceDate", "desc"));

    const unsubscribe = onSnapshot(invoicesQuery, (querySnapshot) => {
      const fetchedInvoices = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          invoiceDate: (data.invoiceDate as Timestamp)?.toDate ? (data.invoiceDate as Timestamp).toDate() : new Date(),
          paidAt: (data.paidAt as Timestamp)?.toDate ? (data.paidAt as Timestamp).toDate() : undefined,
          createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date(),
        } as InvoiceRecordDocument;
      });
      setInvoices(fetchedInvoices);
      setIsLoadingInvoices(false);
    }, (error) => {
      console.error("Error fetching invoices: ", error);
      toast({ title: "Error", description: "Failed to fetch invoices.", variant: "destructive" });
      setIsLoadingInvoices(false);
    });

    return () => unsubscribe();
  }, [toast]);

  useEffect(() => {
    setIsLoadingClients(true);
    const clientsQuery = query(collection(db, "clients"), orderBy("clientName", "asc"));
    const unsubscribeClients = onSnapshot(clientsQuery, (querySnapshot) => {
      const clientsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientDocument));
      setClients(clientsData);
      setIsLoadingClients(false);
    }, (error) => {
      console.error("Error fetching clients: ", error);
      toast({ title: "Error", description: "Failed to fetch clients for filter.", variant: "destructive" });
      setIsLoadingClients(false);
    });
    return () => unsubscribeClients();
  }, [toast]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const utilityMatch = utilityTypeFilter === 'all' || 
                           (invoice.utilityType && invoice.utilityType === utilityTypeFilter) ||
                           (invoice.billingPeriodDescription && invoice.billingPeriodDescription.toLowerCase().includes(utilityTypeFilter));
      const clientMatch = clientFilter === 'all' || invoice.clientId === clientFilter;
      const amountMatch = amountSearch === '' || invoice.totalAmountDue.toString().includes(amountSearch);
      return utilityMatch && clientMatch && amountMatch;
    });
  }, [invoices, utilityTypeFilter, clientFilter, amountSearch]);

  const clearFilters = () => {
    setUtilityTypeFilter("all");
    setClientFilter("all");
    setAmountSearch("");
  };

  const handleMarkAsPaidClick = (invoice: InvoiceRecordDocument) => {
    setSelectedInvoice(invoice);
    setIsModalOpen(true);
  };

  const handleConfirmPayment = async (invoiceId: string, orNumber: string) => {
    if (!selectedInvoice) {
        throw new Error("No invoice selected to process payment.");
    }
    const batch = writeBatch(db);

    try {
        // 1. Update the invoice status
        const invoiceRef = doc(db, "invoices", invoiceId);
        batch.update(invoiceRef, {
            status: "paid",
            officialReceiptNumber: orNumber,
            paidAt: serverTimestamp(),
        });
        
        // 2. Update the corresponding reading(s) notes
        const { regenerationData, clientId, utilityType } = selectedInvoice;
        const readingsCollectionName = utilityType === 'power' ? 'power-readings' : 'water-readings';
        const updatedNotes = `Paid - OR# ${orNumber}`;

        if (selectedInvoice.invoiceType === 'single') {
            const { billingMonth, billingYear } = regenerationData;
            const readingQuery = query(
                collection(db, readingsCollectionName),
                where("clientId", "==", clientId),
                where("billingMonth", "==", billingMonth),
                where("billingYear", "==", billingYear),
                limit(1)
            );
            const readingSnapshot = await getDocs(readingQuery);
            if (!readingSnapshot.empty) {
                const readingDocRef = readingSnapshot.docs[0].ref;
                batch.update(readingDocRef, { notes: updatedNotes });
            } else {
                 console.warn(`Could not find a matching single reading for invoice ${invoiceId} to update notes.`);
            }
        } else { // 'batch'
            const lineItems = regenerationData.lineItems || [];
            for (const item of lineItems) {
                const descriptionParts = item.description.split(" - ");
                const periodPart = descriptionParts.length > 1 ? descriptionParts[1] : "";
                const [monthStr, yearStr] = periodPart.split(" ");
                const billingMonth = monthStr;
                const billingYear = parseInt(yearStr, 10);

                if (billingMonth && !isNaN(billingYear)) {
                    const readingQuery = query(
                        collection(db, readingsCollectionName),
                        where("clientId", "==", clientId),
                        where("billingMonth", "==", billingMonth),
                        where("billingYear", "==", billingYear),
                        limit(1)
                    );
                     const readingSnapshot = await getDocs(readingQuery);
                     if (!readingSnapshot.empty) {
                        const readingDocRef = readingSnapshot.docs[0].ref;
                        batch.update(readingDocRef, { notes: updatedNotes });
                     } else {
                         console.warn(`Could not find a matching batch reading for period ${billingMonth} ${billingYear} for invoice ${invoiceId}.`);
                     }
                }
            }
        }
        
        // Commit all updates
        await batch.commit();

    } catch (error) {
        console.error("Error updating invoice status and reading notes: ", error);
        throw error;
    }
  };

  const handleRedownload = async (invoice: InvoiceRecordDocument) => {
    if (!invoice.regenerationData) {
      toast({ title: "Error", description: "This invoice lacks the data needed for redownloading.", variant: "destructive"});
      return;
    }
    setIsRedownloadingId(invoice.id);
    try {
      await generatePdf(invoice.regenerationData, invoice.invoiceType);
      toast({ title: "Invoice Redownloaded", description: `Invoice ${invoice.invoiceNumber} is being downloaded.`});
    } catch (error) {
      console.error("Error redownloading PDF: ", error);
      toast({ title: "PDF Generation Failed", description: (error as Error).message || "Could not generate the PDF.", variant: "destructive"});
    } finally {
      setIsRedownloadingId(null);
    }
  };

  const handlePreview = async (invoice: InvoiceRecordDocument) => {
    if (!invoice.regenerationData) {
      toast({ title: "Error", description: "This invoice lacks the data needed for previewing.", variant: "destructive"});
      return;
    }
    setIsPreviewLoadingId(invoice.id);
    try {
      const dataUrl = await generatePdf(invoice.regenerationData, invoice.invoiceType, 'getDataUrl');
      if (dataUrl) {
          setPreviewPdfUrl(dataUrl as string);
          setIsPreviewModalOpen(true);
      } else {
          toast({ title: "Preview Failed", description: "Could not generate preview.", variant: "destructive"});
      }
    } catch (error) {
      console.error("Error generating PDF preview: ", error);
      toast({ title: "Preview Failed", description: (error as Error).message || "Could not generate the PDF preview.", variant: "destructive"});
    } finally {
      setIsPreviewLoadingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const hasActiveFilters = utilityTypeFilter !== 'all' || clientFilter !== 'all' || amountSearch !== '';

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Invoice Records" />
      <div className="flex-1 space-y-6 p-4 md:p-6">

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ListFilter className="h-6 w-6 text-primary"/>Filter Invoices</CardTitle>
                <CardDescription>Refine the list of invoices using the filters below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="filter-utility">Utility Type</Label>
                        <Select value={utilityTypeFilter} onValueChange={(value) => setUtilityTypeFilter(value as any)}>
                            <SelectTrigger id="filter-utility" className="mt-1">
                                <SelectValue placeholder="All Utilities" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Utilities</SelectItem>
                                <SelectItem value="power">Power</SelectItem>
                                <SelectItem value="water">Water</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="filter-client">Client Name</Label>
                        <Select value={clientFilter} onValueChange={setClientFilter} disabled={isLoadingClients}>
                            <SelectTrigger id="filter-client" className="mt-1">
                                <SelectValue placeholder={isLoadingClients ? "Loading..." : "All Clients"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Clients</SelectItem>
                                {clients.map(client => (
                                    <SelectItem key={client.id} value={client.id}>{client.clientName} ({client.stallNo})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="search-amount">Search Amount Due</Label>
                        <Input 
                            id="search-amount"
                            type="text"
                            placeholder="e.g., 1234.56"
                            value={amountSearch}
                            onChange={(e) => setAmountSearch(e.target.value.replace(/[^0-9.]/g, ''))}
                            className="mt-1"
                        />
                    </div>
                </div>
                 {hasActiveFilters && (
                    <Button variant="outline" onClick={clearFilters}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Clear Filters
                    </Button>
                )}
            </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-6 w-6 text-primary" />
              All Generated Invoices
            </CardTitle>
            <CardDescription>
              View and manage all single and batch invoices. Click on an invoice to see details, redownload, or mark as paid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingInvoices ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredInvoices.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No invoices found matching your criteria.</p>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {filteredInvoices.map((invoice) => (
                  <AccordionItem value={invoice.id} key={invoice.id}>
                    <AccordionTrigger className="hover:bg-muted/50 px-4 py-3 rounded-md">
                      <div className="flex flex-1 items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                           <FileText className="h-5 w-5 text-primary/80" />
                           <span className="font-medium">{invoice.invoiceNumber}</span>
                           <span className="text-muted-foreground truncate max-w-[150px] md:max-w-[250px] hidden sm:inline" title={invoice.clientName}>{invoice.clientName} ({invoice.stallNo})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {invoice.utilityType && (
                           <Badge variant={invoice.utilityType === 'power' ? 'default' : 'secondary'} className={invoice.utilityType === 'power' ? '' : 'bg-blue-600 hover:bg-blue-700 text-white'}>
                            {invoice.utilityType.charAt(0).toUpperCase() + invoice.utilityType.slice(1)}
                           </Badge>
                          )}
                          <span className="text-muted-foreground hidden md:inline">{format(invoice.invoiceDate, "MMM dd, yyyy")}</span>
                          <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'} className={invoice.status === 'paid' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}>
                            {invoice.status === 'paid' ? <CheckCircle className="mr-1 h-3.5 w-3.5"/> : <Clock className="mr-1 h-3.5 w-3.5"/>}
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 py-3 bg-muted/30 rounded-b-md space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <p><strong>Client:</strong> {invoice.clientName} ({invoice.stallNo})</p>
                        <p><strong>Invoice Date (on PDF):</strong> {invoice.displayInvoiceDate}</p>
                        <p><strong>Billing Details:</strong> {invoice.billingPeriodDescription}</p>
                        <div><Badge variant="outline">{invoice.invoiceType === 'single' ? 'Single Invoice' : 'Batch Invoice'}</Badge></div>
                        <p className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-1 text-green-600"/>
                          <strong>Total Amount Due:</strong> 
                          <span className="ml-1 font-semibold">{formatCurrency(invoice.totalAmountDue)}</span>
                        </p>
                         {invoice.status === 'paid' && invoice.officialReceiptNumber && (
                           <p><strong>O.R. Number:</strong> <span className="font-semibold">{invoice.officialReceiptNumber}</span></p>
                         )}
                         {invoice.status === 'paid' && invoice.paidAt && (
                           <p><strong>Paid On:</strong> {format(invoice.paidAt, "MMM dd, yyyy, hh:mm a")}</p>
                         )}
                      </div>
                     
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePreview(invoice)}
                            disabled={isPreviewLoadingId === invoice.id || !invoice.regenerationData}
                            title={!invoice.regenerationData ? "Preview not available for this invoice" : "Preview Invoice PDF"}
                        >
                            {isPreviewLoadingId === invoice.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Eye className="mr-2 h-4 w-4" />
                            )}
                            Preview
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRedownload(invoice)}
                            disabled={isRedownloadingId === invoice.id || !invoice.regenerationData}
                            title={!invoice.regenerationData ? "Redownload not available for this invoice" : "Redownload Invoice PDF"}
                        >
                            {isRedownloadingId === invoice.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="mr-2 h-4 w-4" />
                            )}
                            Redownload
                        </Button>
                        {invoice.status === 'unpaid' && (
                            <Button size="sm" onClick={() => handleMarkAsPaidClick(invoice)}>
                                <CheckCircle className="mr-2 h-4 w-4" /> Mark as Paid
                            </Button>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
      {selectedInvoice && (
        <MarkAsPaidModal
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          invoice={selectedInvoice}
          onConfirm={handleConfirmPayment}
        />
      )}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full bg-muted/30 rounded-md overflow-hidden">
            {previewPdfUrl ? (
              <iframe src={previewPdfUrl} className="w-full h-full border-0" title="PDF Preview" />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

    