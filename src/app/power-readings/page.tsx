
"use client";

import type { ChangeEvent } from 'react';
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Edit, Search, XCircle, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, Timestamp, DocumentData, QueryConstraint, getDocs, limit } from "firebase/firestore";
import type { ClientDocument, PowerReadingDocument, MotherBillDocument, InvoiceData } from "@/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

const ALL_CLIENTS_SELECT_ITEM_VALUE = "__all_clients__";
const ANY_MONTH_SELECT_ITEM_VALUE = "__any_month__";
const ANY_YEAR_SELECT_ITEM_VALUE = "__any_year__";

export default function PowerReadingsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [powerReadings, setPowerReadings] = useState<PowerReadingDocument[]>([]);
  const [isLoadingReadings, setIsLoadingReadings] = useState(true);

  const [filterClientId, setFilterClientId] = useState<string>("");
  const [filterDateBilled, setFilterDateBilled] = useState<Date | undefined>(undefined);
  const [filterBillingMonth, setFilterBillingMonth] = useState<string>("");
  const [filterBillingYear, setFilterBillingYear] = useState<string>("");

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null);

  // Fetch clients for the filter dropdown
  useEffect(() => {
    setIsLoadingClients(true);
    const clientsQuery = query(collection(db, "clients"), orderBy("clientName", "asc"));
    const unsubscribe = onSnapshot(clientsQuery, (querySnapshot) => {
      const clientsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as ClientDocument));
      setClients(clientsData);
      setIsLoadingClients(false);
    }, (error) => {
      console.error("Error fetching clients: ", error);
      toast({ title: "Error", description: "Failed to fetch clients.", variant: "destructive" });
      setIsLoadingClients(false);
    });
    return () => unsubscribe();
  }, [toast]);

  // Fetch and filter power readings
  useEffect(() => {
    setIsLoadingReadings(true);
    let readingsQueryConstraints: QueryConstraint[] = [];

    if (filterClientId && filterClientId !== ALL_CLIENTS_SELECT_ITEM_VALUE) {
      readingsQueryConstraints.push(where("clientId", "==", filterClientId));
    }
    if (filterDateBilled) {
      const startOfDay = new Date(filterDateBilled);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filterDateBilled);
      endOfDay.setHours(23, 59, 59, 999);
      readingsQueryConstraints.push(where("dateBilled", ">=", Timestamp.fromDate(startOfDay)));
      readingsQueryConstraints.push(where("dateBilled", "<=", Timestamp.fromDate(endOfDay)));
    }
    if (filterBillingMonth && filterBillingMonth !== ANY_MONTH_SELECT_ITEM_VALUE) {
      readingsQueryConstraints.push(where("billingMonth", "==", filterBillingMonth));
    }
    if (filterBillingYear && filterBillingYear !== ANY_YEAR_SELECT_ITEM_VALUE) {
      readingsQueryConstraints.push(where("billingYear", "==", parseInt(filterBillingYear, 10)));
    }

    const finalQuery = query(collection(db, "power-readings"), ...readingsQueryConstraints, orderBy("dateBilled", "desc"));

    const unsubscribe = onSnapshot(finalQuery, (querySnapshot) => {
      const readingsData = querySnapshot.docs.map(doc => {
        const data = doc.data() as DocumentData;
        return {
          id: doc.id,
          ...data,
          dateBilled: (data.dateBilled as Timestamp).toDate(),
        } as PowerReadingDocument;
      });
      setPowerReadings(readingsData);
      setIsLoadingReadings(false);
    }, (error) => {
      console.error("Error fetching power readings: ", error);
      toast({ title: "Error", description: "Failed to fetch power readings.", variant: "destructive" });
      setIsLoadingReadings(false);
    });

    return () => unsubscribe();
  }, [toast, filterClientId, filterDateBilled, filterBillingMonth, filterBillingYear]);

  const handleGenerateInvoiceClick = async (reading: PowerReadingDocument) => {
    if (!reading.id) return;
    setGeneratingInvoiceId(reading.id);
    setInvoiceData(null); 
    try {
      const motherBillQuery = query(
        collection(db, "mother-bills"),
        where("utilityType", "==", "power"),
        where("billingMonth", "==", reading.billingMonth),
        where("billingYear", "==", reading.billingYear),
        limit(1)
      );

      const motherBillSnapshot = await getDocs(motherBillQuery);

      if (motherBillSnapshot.empty) {
        toast({
          title: "Mother Bill Not Found",
          description: `No power mother bill found for ${reading.billingMonth} ${reading.billingYear}. Cannot generate invoice.`,
          variant: "destructive",
        });
        setGeneratingInvoiceId(null);
        return;
      }

      const motherBill = motherBillSnapshot.docs[0].data() as MotherBillDocument;

      if (motherBill.totalConsumption === 0) {
        toast({
          title: "Invalid Mother Bill Data",
          description: `Mother bill for ${reading.billingMonth} ${reading.billingYear} has zero total consumption. Cannot calculate rate.`,
          variant: "destructive",
        });
        setGeneratingInvoiceId(null);
        return;
      }
      
      const basicRate = motherBill.totalAmountBilled / motherBill.totalConsumption;
      const amountBeforeVAT = basicRate * reading.totalKwh;
      const vatAmount = amountBeforeVAT * 0.12;
      const totalAmountDue = amountBeforeVAT + vatAmount;

      // Construct invoice data
      const currentDate = new Date();
      setInvoiceData({
        clientName: reading.clientName,
        stallNo: reading.stallNo,
        billingMonth: reading.billingMonth,
        billingYear: reading.billingYear,
        clientPreviousReading: reading.previousReading,
        clientPresentReading: reading.presentReading,
        clientTotalKwh: reading.totalKwh,
        motherBillTotalAmount: motherBill.totalAmountBilled,
        motherBillTotalConsumption: motherBill.totalConsumption,
        basicRate: basicRate,
        amountBeforeVAT: amountBeforeVAT,
        vatAmount: vatAmount,
        totalAmountDue: totalAmountDue,
        // Fields required by the full InvoiceData type for the dedicated invoice page,
        // some can be placeholders or simplified for this modal.
        invoiceNumber: `${reading.stallNo.replace(/[^A-Z0-9]/ig, '')}-${reading.billingYear}${MONTHS.indexOf(reading.billingMonth).toString().padStart(2, '0')}-MODAL`,
        invoiceDate: format(currentDate, "MMMM dd, yyyy"),
        dueDate: format(currentDate, "MMMM dd, yyyy"), // Example: Due today for modal
        companyName: "BFPC Commercial Complex", 
        companyAddressLine1: "123 Market Street", 
        companyAddressLine2: "Cityville, ST 12345",
      });
      setIsInvoiceModalOpen(true);

    } catch (error) {
      console.error("Error generating invoice: ", error);
      toast({
        title: "Invoice Generation Failed",
        description: "Could not generate invoice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingInvoiceId(null);
    }
  };

  const handleEdit = (readingId: string) => {
    toast({ title: "Edit Clicked", description: `Would edit reading: ${readingId}` });
  };

  const clearFilters = () => {
    setFilterClientId("");
    setFilterDateBilled(undefined);
    setFilterBillingMonth("");
    setFilterBillingYear("");
  };
  
  const hasActiveFilters = useMemo(() => {
    return (filterClientId && filterClientId !== ALL_CLIENTS_SELECT_ITEM_VALUE) || 
           !!filterDateBilled || 
           (filterBillingMonth && filterBillingMonth !== ANY_MONTH_SELECT_ITEM_VALUE) || 
           (filterBillingYear && filterBillingYear !== ANY_YEAR_SELECT_ITEM_VALUE);
  }, [filterClientId, filterDateBilled, filterBillingMonth, filterBillingYear]);


  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Power Readings Records" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-6 w-6 text-primary" />
              Filter Power Readings
            </CardTitle>
            <CardDescription>
              Refine the list of power readings using the filters below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="filter-client">Client Name</Label>
                <Select
                  value={filterClientId || ALL_CLIENTS_SELECT_ITEM_VALUE}
                  onValueChange={setFilterClientId}
                  disabled={isLoadingClients}
                >
                  <SelectTrigger id="filter-client" className="mt-1">
                    <SelectValue placeholder={isLoadingClients ? "Loading..." : "All Clients"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CLIENTS_SELECT_ITEM_VALUE}>All Clients</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.clientName} ({client.stallNo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filter-date-billed">Date Billed</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1",
                        !filterDateBilled && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterDateBilled ? format(filterDateBilled, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filterDateBilled}
                      onSelect={setFilterDateBilled}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="filter-billing-month">Billing Month</Label>
                <Select 
                  value={filterBillingMonth || ANY_MONTH_SELECT_ITEM_VALUE}
                  onValueChange={setFilterBillingMonth}
                >
                  <SelectTrigger id="filter-billing-month" className="mt-1">
                    <SelectValue placeholder="Any Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_MONTH_SELECT_ITEM_VALUE}>Any Month</SelectItem>
                    {MONTHS.map((month) => (
                      <SelectItem key={month} value={month}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filter-billing-year">Billing Year</Label>
                 <Select 
                    value={filterBillingYear || ANY_YEAR_SELECT_ITEM_VALUE} 
                    onValueChange={setFilterBillingYear}
                  >
                  <SelectTrigger id="filter-billing-year" className="mt-1">
                    <SelectValue placeholder="Any Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_YEAR_SELECT_ITEM_VALUE}>Any Year</SelectItem>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {hasActiveFilters && (
                 <Button variant="outline" onClick={clearFilters} className="mt-4">
                    <XCircle className="mr-2 h-4 w-4" />
                    Clear Filters
                </Button>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Recorded Readings</CardTitle>
            <CardDescription>
              List of all power readings based on active filters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingReadings ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : powerReadings.length === 0 ? (
              <p className="text-muted-foreground text-center">No power readings found matching your criteria.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Stall No.</TableHead>
                    <TableHead>Date Billed</TableHead>
                    <TableHead>Billing Period</TableHead>
                    <TableHead className="text-right">Prev. (kWh)</TableHead>
                    <TableHead className="text-right">Pres. (kWh)</TableHead>
                    <TableHead className="text-right">Total (kWh)</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {powerReadings.map((reading) => (
                    <TableRow key={reading.id}>
                      <TableCell>{reading.clientName}</TableCell>
                      <TableCell>{reading.stallNo}</TableCell>
                      <TableCell>{reading.dateBilled ? format(new Date(reading.dateBilled), "MMM dd, yyyy") : 'N/A'}</TableCell>
                      <TableCell>{reading.billingMonth} {reading.billingYear}</TableCell>
                      <TableCell className="text-right">{reading.previousReading.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{reading.presentReading.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold">{reading.totalKwh.toLocaleString()}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={reading.notes}>{reading.notes || "-"}</TableCell>
                      <TableCell className="text-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reading.id && handleGenerateInvoiceClick(reading)}
                          disabled={!reading.id || generatingInvoiceId === reading.id}
                        >
                          {generatingInvoiceId === reading.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <FileText className="mr-1 h-3 w-3" />
                          )}
                          Invoice
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reading.id && handleEdit(reading.id)}
                          disabled={!reading.id}
                        >
                          <Edit className="mr-1 h-3 w-3" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {invoiceData && (
        <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Invoice Details</DialogTitle>
              <DialogDescription>
                Billing Period: {invoiceData.billingMonth} {invoiceData.billingYear}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 text-sm">
              <div className="border-b pb-2">
                <h4 className="font-semibold text-base mb-1">Client Information</h4>
                <p><strong>Client:</strong> {invoiceData.clientName}</p>
                <p><strong>Stall No:</strong> {invoiceData.stallNo}</p>
              </div>

              <div className="border-b pb-2">
                <h4 className="font-semibold text-base mb-1">Power Consumption</h4>
                <p>Previous Reading: {invoiceData.clientPreviousReading.toLocaleString()} kWh</p>
                <p>Present Reading: {invoiceData.clientPresentReading.toLocaleString()} kWh</p>
                <p><strong>Total Consumed:</strong> {invoiceData.clientTotalKwh.toLocaleString()} kWh</p>
              </div>
              
              <div className="border-b pb-2">
                <h4 className="font-semibold text-base mb-1">Rate Calculation (based on Mother Bill)</h4>
                <p>Mother Bill Total Amount: {invoiceData.motherBillTotalAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p>Mother Bill Total Consumption: {invoiceData.motherBillTotalConsumption.toLocaleString()} kWh</p>
                <p><strong>Basic Rate:</strong> ₱{invoiceData.basicRate.toFixed(4)} / kWh</p>
              </div>

              <div>
                <h4 className="font-semibold text-base mb-1">Amount Due</h4>
                <div className="grid grid-cols-2 gap-x-2">
                  <span>Subtotal:</span>
                  <span className="text-right">{invoiceData.amountBeforeVAT.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span>VAT (12%):</span>
                  <span className="text-right">{invoiceData.vatAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <strong className="text-lg">Total Amount Due:</strong>
                  <strong className="text-lg text-right">{invoiceData.totalAmountDue.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsInvoiceModalOpen(false)}>Close</Button>
              {/* PDF Export button can be added here later */}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
