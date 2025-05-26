
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Edit, Search, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, Timestamp, DocumentData, QueryConstraint } from "firebase/firestore";
import type { ClientDocument, PowerReadingDocument } from "@/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i); // Last 5 years and next 5 years

// Define unique non-empty values for "all" select items
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

    if (filterClientId) {
      readingsQueryConstraints.push(where("clientId", "==", filterClientId));
    }
    if (filterDateBilled) {
      // Firestore query for a specific day requires a range
      const startOfDay = new Date(filterDateBilled);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filterDateBilled);
      endOfDay.setHours(23, 59, 59, 999);
      readingsQueryConstraints.push(where("dateBilled", ">=", Timestamp.fromDate(startOfDay)));
      readingsQueryConstraints.push(where("dateBilled", "<=", Timestamp.fromDate(endOfDay)));
    }
    if (filterBillingMonth) {
      readingsQueryConstraints.push(where("billingMonth", "==", filterBillingMonth));
    }
    if (filterBillingYear) {
      readingsQueryConstraints.push(where("billingYear", "==", parseInt(filterBillingYear, 10)));
    }

    const finalQuery = query(collection(db, "power-readings"), ...readingsQueryConstraints, orderBy("dateBilled", "desc"));

    const unsubscribe = onSnapshot(finalQuery, (querySnapshot) => {
      const readingsData = querySnapshot.docs.map(doc => {
        const data = doc.data() as DocumentData;
        return {
          id: doc.id,
          ...data,
          dateBilled: (data.dateBilled as Timestamp).toDate(), // Convert Firestore Timestamp to JS Date
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

  const handleEdit = (readingId: string) => {
    // Placeholder for edit functionality
    toast({ title: "Edit Clicked", description: `Would edit reading: ${readingId}` });
  };

  const clearFilters = () => {
    setFilterClientId("");
    setFilterDateBilled(undefined);
    setFilterBillingMonth("");
    setFilterBillingYear("");
  };
  
  const hasActiveFilters = useMemo(() => {
    return !!filterClientId || !!filterDateBilled || !!filterBillingMonth || !!filterBillingYear;
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
                  value={filterClientId} // Select value can be "", which shows the placeholder
                  onValueChange={(selectedValue) => {
                    setFilterClientId(selectedValue === ALL_CLIENTS_SELECT_ITEM_VALUE ? "" : selectedValue);
                  }}
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
                  value={filterBillingMonth}
                  onValueChange={(selectedValue) => {
                    setFilterBillingMonth(selectedValue === ANY_MONTH_SELECT_ITEM_VALUE ? "" : selectedValue);
                  }}
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
                    value={filterBillingYear} 
                    onValueChange={(selectedValue) => {
                      setFilterBillingYear(selectedValue === ANY_YEAR_SELECT_ITEM_VALUE ? "" : selectedValue);
                    }}
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
                      <TableCell className="text-center">
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
    </main>
  );
}
