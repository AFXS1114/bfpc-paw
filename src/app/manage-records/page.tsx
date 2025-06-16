
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Trash2, Search, XCircle, Loader2, ListFilter, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, Timestamp, DocumentData, QueryConstraint, deleteDoc, doc } from "firebase/firestore";
import type { ClientDocument, PowerReadingDocument, MotherBillDocument, InvoiceRecordDocument } from "@/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

const ALL_CLIENTS_SELECT_ITEM_VALUE = "__all_clients__";
const ANY_MONTH_SELECT_ITEM_VALUE = "__any_month__";
const ANY_YEAR_SELECT_ITEM_VALUE = "__any_year__";

type RecordType = "powerReadings" | "powerMotherBills" | "invoiceRecords";

interface RecordToDelete {
  id: string;
  type: RecordType;
  displayText: string;
}

const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function ManageRecordsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  
  const [records, setRecords] = useState<(PowerReadingDocument | MotherBillDocument | InvoiceRecordDocument)[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [selectedRecordType, setSelectedRecordType] = useState<RecordType>("powerReadings");

  const [filterClientId, setFilterClientId] = useState<string>("");
  const [filterBillingMonth, setFilterBillingMonth] = useState<string>("");
  const [filterBillingYear, setFilterBillingYear] = useState<string>("");

  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<RecordToDelete | null>(null);

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

  useEffect(() => {
    setIsLoadingRecords(true);
    let recordsQueryConstraints: QueryConstraint[] = [];
    let collectionName = "";
    let mainOrderByField = "createdAt";
    let mainOrderByDirection: "asc" | "desc" = "desc";

    if (selectedRecordType === "powerReadings") {
      collectionName = "power-readings";
      if (filterClientId && filterClientId !== ALL_CLIENTS_SELECT_ITEM_VALUE) {
        recordsQueryConstraints.push(where("clientId", "==", filterClientId));
      }
      if (filterBillingMonth && filterBillingMonth !== ANY_MONTH_SELECT_ITEM_VALUE) {
        recordsQueryConstraints.push(where("billingMonth", "==", filterBillingMonth));
      }
      if (filterBillingYear && filterBillingYear !== ANY_YEAR_SELECT_ITEM_VALUE) {
        recordsQueryConstraints.push(where("billingYear", "==", parseInt(filterBillingYear, 10)));
      }
    } else if (selectedRecordType === "powerMotherBills") {
      collectionName = "mother-bills";
      recordsQueryConstraints.push(where("utilityType", "==", "power"));
      if (filterBillingMonth && filterBillingMonth !== ANY_MONTH_SELECT_ITEM_VALUE) {
        recordsQueryConstraints.push(where("billingMonth", "==", filterBillingMonth));
      }
      if (filterBillingYear && filterBillingYear !== ANY_YEAR_SELECT_ITEM_VALUE) {
        recordsQueryConstraints.push(where("billingYear", "==", parseInt(filterBillingYear, 10)));
      }
    } else if (selectedRecordType === "invoiceRecords") {
      collectionName = "invoices";
      mainOrderByField = "invoiceDate"; // Sort invoices by their issue date
      if (filterClientId && filterClientId !== ALL_CLIENTS_SELECT_ITEM_VALUE) {
        recordsQueryConstraints.push(where("clientId", "==", filterClientId));
      }
      // For invoiceRecords, billingMonth and billingYear filters are not directly applied to the Firestore query for simplicity.
      // They could be used for client-side filtering or more complex date range queries on 'invoiceDate' if needed.
    }

    if (!collectionName) {
        setRecords([]);
        setIsLoadingRecords(false);
        return;
    }
    
    const finalQuery = query(collection(db, collectionName), ...recordsQueryConstraints, orderBy(mainOrderByField, mainOrderByDirection));

    const unsubscribe = onSnapshot(finalQuery, (querySnapshot) => {
      const fetchedRecords = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data() as DocumentData;
        const baseData = {
          id: docSnapshot.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date(),
        };
        if (selectedRecordType === "powerReadings") {
          return {
            ...baseData,
            dateBilled: (data.dateBilled as Timestamp)?.toDate ? (data.dateBilled as Timestamp).toDate() : new Date(),
          } as PowerReadingDocument;
        } else if (selectedRecordType === "powerMotherBills") {
          return baseData as MotherBillDocument;
        } else if (selectedRecordType === "invoiceRecords") {
           return {
            ...baseData,
            invoiceDate: (data.invoiceDate as Timestamp)?.toDate ? (data.invoiceDate as Timestamp).toDate() : new Date(),
            paidAt: (data.paidAt as Timestamp)?.toDate ? (data.paidAt as Timestamp).toDate() : undefined,
          } as InvoiceRecordDocument;
        }
        return baseData; // Should not reach here if types are exhaustive
      });
      setRecords(fetchedRecords as (PowerReadingDocument | MotherBillDocument | InvoiceRecordDocument)[]);
      setIsLoadingRecords(false);
    }, (error) => {
      console.error(`Error fetching ${selectedRecordType}: `, error);
      toast({ title: "Error", description: `Failed to fetch records.`, variant: "destructive" });
      setIsLoadingRecords(false);
    });

    return () => unsubscribe();
  }, [toast, selectedRecordType, filterClientId, filterBillingMonth, filterBillingYear]);


  const handleDeleteClick = (recordId: string, type: RecordType, displayText: string) => {
    setRecordToDelete({ id: recordId, type, displayText });
    setShowDeleteConfirmDialog(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    setIsDeletingId(recordToDelete.id);
    try {
      let collectionNameToDeleteFrom = "";
      if (recordToDelete.type === "powerReadings") collectionNameToDeleteFrom = "power-readings";
      else if (recordToDelete.type === "powerMotherBills") collectionNameToDeleteFrom = "mother-bills";
      else if (recordToDelete.type === "invoiceRecords") collectionNameToDeleteFrom = "invoices";
      
      if (collectionNameToDeleteFrom) {
        await deleteDoc(doc(db, collectionNameToDeleteFrom, recordToDelete.id));
        toast({
            title: "Record Deleted",
            description: `The ${recordToDelete.displayText} has been successfully deleted.`,
        });
      } else {
        throw new Error("Invalid record type for deletion.");
      }
    } catch (error) {
      console.error("Error deleting record: ", error);
      toast({
        title: "Error",
        description: `Failed to delete ${recordToDelete.displayText}.`,
        variant: "destructive",
      });
    } finally {
      setShowDeleteConfirmDialog(false);
      setRecordToDelete(null);
      setIsDeletingId(null);
    }
  };
  
  const clearFilters = () => {
    setFilterClientId("");
    setFilterBillingMonth("");
    setFilterBillingYear("");
  };
  
  const hasActiveFilters = useMemo(() => {
    const clientFilterActive = filterClientId && filterClientId !== ALL_CLIENTS_SELECT_ITEM_VALUE;
    const monthFilterActive = filterBillingMonth && filterBillingMonth !== ANY_MONTH_SELECT_ITEM_VALUE;
    const yearFilterActive = filterBillingYear && filterBillingYear !== ANY_YEAR_SELECT_ITEM_VALUE;

    if (selectedRecordType === "invoiceRecords") {
        return clientFilterActive; // Only client filter applies directly to invoice query for now
    }
    return clientFilterActive || monthFilterActive || yearFilterActive;
  }, [selectedRecordType, filterClientId, filterBillingMonth, filterBillingYear]);

  const getRecordDisplayText = (record: PowerReadingDocument | MotherBillDocument | InvoiceRecordDocument, type: RecordType): string => {
    if (type === "powerReadings") {
        const pr = record as PowerReadingDocument;
        return `power reading for ${pr.clientName} (${pr.billingMonth} ${pr.billingYear})`;
    } else if (type === "powerMotherBills") {
        const mb = record as MotherBillDocument;
        return `power mother bill for ${mb.billingMonth} ${mb.billingYear}`;
    } else if (type === "invoiceRecords") {
        const ir = record as InvoiceRecordDocument;
        return `invoice record for ${ir.clientName} (Inv #: ${ir.invoiceNumber})`;
    }
    return "record";
  };

  const getCardTitle = () => {
    if (selectedRecordType === "powerReadings") return "Power Reading Records";
    if (selectedRecordType === "powerMotherBills") return "Power Mother Bill Records";
    if (selectedRecordType === "invoiceRecords") return "Invoice Records";
    return "Records";
  };

  const getCardDescription = () => {
    return "List of records based on active filters. Click delete to remove a record.";
  }

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Manage Records" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListFilter className="h-6 w-6 text-primary" />
              Filter Records
            </CardTitle>
            <CardDescription>
              Select record type and apply filters to refine the list. Billing Month/Year filters do not apply to Invoice Records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
                <Label htmlFor="select-record-type">Record Type</Label>
                <Select value={selectedRecordType} onValueChange={(value) => setSelectedRecordType(value as RecordType)}>
                    <SelectTrigger id="select-record-type" className="mt-1">
                        <SelectValue placeholder="Select record type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="powerReadings">Power Readings (Client)</SelectItem>
                        <SelectItem value="powerMotherBills">Mother Bills (Power)</SelectItem>
                        <SelectItem value="invoiceRecords">Invoice Records</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="filter-client">Client Name</Label>
                <Select
                  value={filterClientId || ALL_CLIENTS_SELECT_ITEM_VALUE}
                  onValueChange={val => setFilterClientId(val === ALL_CLIENTS_SELECT_ITEM_VALUE ? "" : val)}
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
              {selectedRecordType !== 'invoiceRecords' && (
                <>
                    <div>
                        <Label htmlFor="filter-billing-month">Billing Month</Label>
                        <Select 
                        value={filterBillingMonth || ANY_MONTH_SELECT_ITEM_VALUE}
                        onValueChange={val => setFilterBillingMonth(val === ANY_MONTH_SELECT_ITEM_VALUE ? "" : val)}
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
                            onValueChange={val => setFilterBillingYear(val === ANY_YEAR_SELECT_ITEM_VALUE ? "" : val)}
                        >
                        <SelectTrigger id="filter-billing-year" className="mt-1">
                            <SelectValue placeholder="Any Year" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ANY_YEAR_SELECT_ITEM_VALUE}>Any Year</SelectItem>
                            {YEARS.map((year) => (
                            <SelectItem key={year.toString()} value={year.toString()}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                </>
              )}
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
            <CardTitle>{getCardTitle()}</CardTitle>
            <CardDescription>{getCardDescription()}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRecords ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : records.length === 0 ? (
              <p className="text-muted-foreground text-center">No records found matching your criteria.</p>
            ) : (
              <Table>
                <TableHeader>
                  {selectedRecordType === "powerReadings" ? (
                    <TableRow>
                      <TableHead>Client Name</TableHead>
                      <TableHead>Stall No.</TableHead>
                      <TableHead>Date Billed</TableHead>
                      <TableHead>Billing Period</TableHead>
                      <TableHead className="text-right">Total (kWh)</TableHead>
                      <TableHead>Recorded On</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  ) : selectedRecordType === "powerMotherBills" ? (
                    <TableRow>
                      <TableHead>Billing Period</TableHead>
                      <TableHead className="text-right">Past (kWh)</TableHead>
                      <TableHead className="text-right">Present (kWh)</TableHead>
                      <TableHead className="text-right">Total Cons. (kWh)</TableHead>
                      <TableHead className="text-right">Amount (₱)</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Recorded On</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  ) : selectedRecordType === "invoiceRecords" ? (
                     <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Client Name</TableHead>
                        <TableHead>Stall No.</TableHead>
                        <TableHead>Invoice Date</TableHead>
                        <TableHead>Billing Period</TableHead>
                        <TableHead className="text-right">Amount Due</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead>Recorded On</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  ) : null}
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      {selectedRecordType === "powerReadings" ? (
                        <>
                          <TableCell>{(record as PowerReadingDocument).clientName}</TableCell>
                          <TableCell>{(record as PowerReadingDocument).stallNo}</TableCell>
                          <TableCell>{(record as PowerReadingDocument).dateBilled ? format(new Date((record as PowerReadingDocument).dateBilled), "MMM dd, yyyy") : 'N/A'}</TableCell>
                          <TableCell>{(record as PowerReadingDocument).billingMonth} {(record as PowerReadingDocument).billingYear}</TableCell>
                          <TableCell className="text-right font-semibold">{(record as PowerReadingDocument).totalKwh.toLocaleString()}</TableCell>
                          <TableCell>{record.createdAt ? format(new Date(record.createdAt), "MMM dd, yyyy, HH:mm") : 'N/A'}</TableCell>
                        </>
                      ) : selectedRecordType === "powerMotherBills" ? (
                        <>
                          <TableCell>{(record as MotherBillDocument).billingMonth} {(record as MotherBillDocument).billingYear}</TableCell>
                          <TableCell className="text-right">{(record as MotherBillDocument).pastReading.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{(record as MotherBillDocument).presentReading.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold">{(record as MotherBillDocument).totalConsumption.toLocaleString()}</TableCell>
                           <TableCell className="text-right">
                            {formatCurrency((record as MotherBillDocument).totalAmountBilled)}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate" title={(record as MotherBillDocument).notes}>{(record as MotherBillDocument).notes || "-"}</TableCell>
                          <TableCell>{record.createdAt ? format(new Date(record.createdAt), "MMM dd, yyyy, HH:mm") : 'N/A'}</TableCell>
                        </>
                      ) : selectedRecordType === "invoiceRecords" ? (
                        <>
                            <TableCell>{(record as InvoiceRecordDocument).invoiceNumber}</TableCell>
                            <TableCell>{(record as InvoiceRecordDocument).clientName}</TableCell>
                            <TableCell>{(record as InvoiceRecordDocument).stallNo}</TableCell>
                            <TableCell>{(record as InvoiceRecordDocument).displayInvoiceDate}</TableCell>
                            <TableCell className="max-w-[200px] truncate" title={(record as InvoiceRecordDocument).billingPeriodDescription}>
                                {(record as InvoiceRecordDocument).billingPeriodDescription}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                                {formatCurrency((record as InvoiceRecordDocument).totalAmountDue)}
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge variant={(record as InvoiceRecordDocument).status === 'paid' ? 'default' : 'secondary'} className={(record as InvoiceRecordDocument).status === 'paid' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}>
                                    {(record as InvoiceRecordDocument).status === 'paid' ? <CheckCircle className="mr-1 h-3.5 w-3.5"/> : <Clock className="mr-1 h-3.5 w-3.5"/>}
                                    {(record as InvoiceRecordDocument).status.charAt(0).toUpperCase() + (record as InvoiceRecordDocument).status.slice(1)}
                                </Badge>
                            </TableCell>
                            <TableCell>{(record as InvoiceRecordDocument).createdAt ? format(new Date((record as InvoiceRecordDocument).createdAt), "MMM dd, yyyy, HH:mm") : 'N/A'}</TableCell>
                        </>
                      ) : null }
                      <TableCell className="text-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => record.id && handleDeleteClick(record.id, selectedRecordType, getRecordDisplayText(record, selectedRecordType))}
                          disabled={!record.id || isDeletingId === record.id}
                        >
                          {isDeletingId === record.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="mr-1 h-3 w-3" />
                          )}
                          Delete
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

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {recordToDelete?.displayText || "record"}.
              {(recordToDelete?.type === "powerMotherBills" || recordToDelete?.type === "powerReadings") && 
                " Deleting this record might affect existing invoices or calculations. Consider if this is intended."
              }
               {recordToDelete?.type === "invoiceRecords" &&
                " Deleting this invoice record will remove it from tracking and payment status. The original PDF will not be deleted by this action."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRecordToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className={cn(buttonVariants({ variant: "destructive" }), "bg-destructive hover:bg-destructive/90")}>
              Yes, delete record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

