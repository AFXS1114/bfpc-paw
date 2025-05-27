
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Trash2, Search, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, Timestamp, DocumentData, QueryConstraint, deleteDoc, doc } from "firebase/firestore";
import type { ClientDocument, PowerReadingDocument } from "@/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

const ALL_CLIENTS_SELECT_ITEM_VALUE = "__all_clients__";
const ANY_MONTH_SELECT_ITEM_VALUE = "__any_month__";
const ANY_YEAR_SELECT_ITEM_VALUE = "__any_year__";

export default function ManageRecordsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [powerReadings, setPowerReadings] = useState<PowerReadingDocument[]>([]);
  const [isLoadingReadings, setIsLoadingReadings] = useState(true);

  const [filterClientId, setFilterClientId] = useState<string>("");
  const [filterBillingMonth, setFilterBillingMonth] = useState<string>("");
  const [filterBillingYear, setFilterBillingYear] = useState<string>("");

  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [recordToDeleteId, setRecordToDeleteId] = useState<string | null>(null);

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
    if (filterBillingMonth && filterBillingMonth !== ANY_MONTH_SELECT_ITEM_VALUE) {
      readingsQueryConstraints.push(where("billingMonth", "==", filterBillingMonth));
    }
    if (filterBillingYear && filterBillingYear !== ANY_YEAR_SELECT_ITEM_VALUE) {
      readingsQueryConstraints.push(where("billingYear", "==", parseInt(filterBillingYear, 10)));
    }

    const finalQuery = query(collection(db, "power-readings"), ...readingsQueryConstraints, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(finalQuery, (querySnapshot) => {
      const readingsData = querySnapshot.docs.map(doc => {
        const data = doc.data() as DocumentData;
        return {
          id: doc.id,
          ...data,
          dateBilled: (data.dateBilled as Timestamp)?.toDate(), // Convert Timestamp to Date
          createdAt: (data.createdAt as Timestamp)?.toDate(), // Convert Timestamp to Date
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
  }, [toast, filterClientId, filterBillingMonth, filterBillingYear]);


  const handleDeleteClick = (readingId: string) => {
    setRecordToDeleteId(readingId);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDelete = async () => {
    if (!recordToDeleteId) return;
    setIsDeletingId(recordToDeleteId);
    try {
      await deleteDoc(doc(db, "power-readings", recordToDeleteId));
      toast({
        title: "Record Deleted",
        description: "The power reading record has been successfully deleted.",
      });
    } catch (error) {
      console.error("Error deleting power reading: ", error);
      toast({
        title: "Error",
        description: "Failed to delete power reading record.",
        variant: "destructive",
      });
    } finally {
      setShowDeleteConfirmDialog(false);
      setRecordToDeleteId(null);
      setIsDeletingId(null);
    }
  };
  
  const clearFilters = () => {
    setFilterClientId("");
    setFilterBillingMonth("");
    setFilterBillingYear("");
  };
  
  const hasActiveFilters = useMemo(() => {
    return (filterClientId && filterClientId !== ALL_CLIENTS_SELECT_ITEM_VALUE) || 
           (filterBillingMonth && filterBillingMonth !== ANY_MONTH_SELECT_ITEM_VALUE) || 
           (filterBillingYear && filterBillingYear !== ANY_YEAR_SELECT_ITEM_VALUE);
  }, [filterClientId, filterBillingMonth, filterBillingYear]);


  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Manage Records - Power Readings" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-6 w-6 text-primary" />
              Filter Power Readings
            </CardTitle>
            <CardDescription>
              Refine the list of power readings to manage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <SelectItem key={ALL_CLIENTS_SELECT_ITEM_VALUE} value={ALL_CLIENTS_SELECT_ITEM_VALUE}>All Clients</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.clientName} ({client.stallNo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                    <SelectItem key={ANY_MONTH_SELECT_ITEM_VALUE} value={ANY_MONTH_SELECT_ITEM_VALUE}>Any Month</SelectItem>
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
                    <SelectItem key={ANY_YEAR_SELECT_ITEM_VALUE} value={ANY_YEAR_SELECT_ITEM_VALUE}>Any Year</SelectItem>
                    {YEARS.map((year) => (
                      <SelectItem key={year.toString()} value={year.toString()}>{year}</SelectItem>
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
            <CardTitle>Power Reading Records</CardTitle>
            <CardDescription>
              List of power readings based on active filters. Click delete to remove a record.
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
                    <TableHead className="text-right">Total (kWh)</TableHead>
                    <TableHead>Recorded On</TableHead>
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
                      <TableCell className="text-right font-semibold">{reading.totalKwh.toLocaleString()}</TableCell>
                      <TableCell>{reading.createdAt ? format(new Date(reading.createdAt), "MMM dd, yyyy, HH:mm") : 'N/A'}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => reading.id && handleDeleteClick(reading.id)}
                          disabled={!reading.id || isDeletingId === reading.id}
                        >
                          {isDeletingId === reading.id ? (
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
              This action cannot be undone. This will permanently delete the power reading record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRecordToDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className={buttonVariants({ variant: "destructive" })}>
              Yes, delete record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

    