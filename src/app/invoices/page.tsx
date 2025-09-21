
"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import type { InvoiceRecordDocument } from "@/types";
import { MarkAsPaidModal } from "@/components/mark-as-paid-modal";
import { format } from "date-fns";
import { Archive, CheckCircle, Clock, FileText, DollarSign, Download, Loader2 } from "lucide-react";
import { generatePdf } from "@/lib/invoice-helpers";

export default function InvoicesPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceRecordDocument[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecordDocument | null>(null);
  const [isRedownloadingId, setIsRedownloadingId] = useState<string | null>(null);

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

  const handleMarkAsPaidClick = (invoice: InvoiceRecordDocument) => {
    setSelectedInvoice(invoice);
    setIsModalOpen(true);
  };

  const handleConfirmPayment = async (invoiceId: string, orNumber: string) => {
    try {
      const invoiceRef = doc(db, "invoices", invoiceId);
      await updateDoc(invoiceRef, {
        status: "paid",
        officialReceiptNumber: orNumber,
        paidAt: serverTimestamp(),
      });
      // No need to manually refetch, onSnapshot will update the list
    } catch (error) {
      console.error("Error updating invoice status: ", error);
      throw error; // Re-throw to be caught by modal's error handler
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


  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Invoice Records" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
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
            ) : invoices.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No invoices found.</p>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {invoices.map((invoice) => (
                  <AccordionItem value={invoice.id} key={invoice.id}>
                    <AccordionTrigger className="hover:bg-muted/50 px-4 py-3 rounded-md">
                      <div className="flex flex-1 items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                           <FileText className="h-5 w-5 text-primary/80" />
                           <span className="font-medium">{invoice.invoiceNumber}</span>
                           <span className="text-muted-foreground truncate max-w-[150px] md:max-w-[250px] hidden sm:inline" title={invoice.clientName}>{invoice.clientName} ({invoice.stallNo})</span>
                        </div>
                        <div className="flex items-center gap-3">
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
                        <p><strong>Type:</strong> <Badge variant="outline">{invoice.invoiceType === 'single' ? 'Single Invoice' : 'Batch Invoice'}</Badge></p>
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
    </main>
  );
}
