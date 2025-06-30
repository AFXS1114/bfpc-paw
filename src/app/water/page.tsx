
"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Save, Loader2, Info, History, Droplet } from "lucide-react";
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, where, getDocs, limit } from "firebase/firestore";
import type { ClientDocument, WaterReadingEntry, WaterReadingDocument } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

const waterReadingFormSchema = z.object({
  dateBilled: z.date({ required_error: "Date billed is required." }),
  clientId: z.string().min(1, "Client selection is required."),
  billingMonth: z.string().min(1, "Billing month is required."),
  billingYear: z.coerce.number().min(2000, "Invalid year.").max(2099, "Invalid year."),
  previousReading: z.coerce.number().min(0, "Previous reading must be non-negative."),
  presentReading: z.coerce.number().min(0, "Present reading must be non-negative."),
  notes: z.string().optional(),
}).refine(data => data.presentReading >= data.previousReading, {
  message: "Present reading must be greater than or equal to previous reading.",
  path: ["presentReading"],
});

type WaterReadingFormData = z.infer<typeof waterReadingFormSchema>;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface SelectedClientDisplayInfo {
  stallNo: string;
  waterMeterNo: string;
  latestReading?: {
    period: string;
    dateBilled: string;
    previousReading: number;
    presentReading: number;
    totalM3: number;
  } | null; 
}

export default function WaterPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [selectedClientInfo, setSelectedClientInfo] = useState<SelectedClientDisplayInfo | null>(null);
  const [isLoadingLatestReading, setIsLoadingLatestReading] = useState(false);


  const form = useForm<WaterReadingFormData>({
    resolver: zodResolver(waterReadingFormSchema),
    defaultValues: {
      dateBilled: new Date(),
      clientId: "",
      billingMonth: MONTHS[new Date().getMonth()],
      billingYear: new Date().getFullYear(),
      previousReading: 0,
      presentReading: 0,
      notes: "",
    },
  });

  const { watch, setValue } = form;
  const selectedClientId = watch("clientId");
  const previousReading = watch("previousReading");
  const presentReading = watch("presentReading");

  const totalM3 = useMemo(() => {
    const prev = Number(previousReading);
    const pres = Number(presentReading);
    if (!isNaN(prev) && !isNaN(pres) && pres >= prev) {
      return pres - prev;
    }
    return 0;
  }, [previousReading, presentReading]);

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
      toast({
        title: "Error",
        description: "Failed to fetch clients.",
        variant: "destructive",
      });
      setIsLoadingClients(false);
    });

    return () => unsubscribe();
  }, [toast]);

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        setSelectedClientInfo({ 
            stallNo: client.stallNo, 
            waterMeterNo: client.waterMeterNo,
        });
        setIsLoadingLatestReading(true);

        const fetchLatestReading = async () => {
          try {
            const latestReadingQuery = query(
              collection(db, "water-readings"),
              where("clientId", "==", selectedClientId),
              orderBy("createdAt", "desc"),
              limit(1)
            );
            const snapshot = await getDocs(latestReadingQuery);
            if (!snapshot.empty) {
              const firestoreData = snapshot.docs[0].data();
              const dateBilledFromFirestore = firestoreData.dateBilled as Timestamp;

              const latestReadingDetails = {
                period: `${firestoreData.billingMonth} ${firestoreData.billingYear}`,
                dateBilled: dateBilledFromFirestore ? format(dateBilledFromFirestore.toDate(), "PPP") : 'N/A',
                previousReading: firestoreData.previousReading,
                presentReading: firestoreData.presentReading,
                totalM3: firestoreData.totalM3,
              };
              setSelectedClientInfo(prevInfo => ({
                ...prevInfo!,
                latestReading: latestReadingDetails
              }));
              setValue('previousReading', latestReadingDetails.presentReading);

            } else {
              setSelectedClientInfo(prevInfo => ({ ...prevInfo!, latestReading: null }));
              setValue('previousReading', 0);
            }
          } catch (error) {
            console.error("Error fetching latest water reading:", error);
            toast({ title: "Error", description: "Could not fetch latest reading for client.", variant: "destructive" });
            setSelectedClientInfo(prevInfo => ({ ...prevInfo!, latestReading: null }));
            setValue('previousReading', 0);
          } finally {
            setIsLoadingLatestReading(false);
          }
        };
        fetchLatestReading();

      } else {
        setSelectedClientInfo(null);
        setValue('previousReading', 0);
        setIsLoadingLatestReading(false);
      }
    } else {
      setSelectedClientInfo(null);
      setValue('previousReading', 0);
      setIsLoadingLatestReading(false);
    }
  }, [selectedClientId, clients, toast, setValue]);

  async function onSubmit(data: WaterReadingFormData) {
    setIsSubmitting(true);
    const client = clients.find(c => c.id === data.clientId);
    if (!client) {
      toast({ title: "Error", description: "Selected client not found.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    try {
      const checkForExistingQuery = query(
        collection(db, "water-readings"),
        where("clientId", "==", data.clientId),
        where("billingMonth", "==", data.billingMonth),
        where("billingYear", "==", data.billingYear),
        limit(1)
      );

      const existingSnapshot = await getDocs(checkForExistingQuery);

      if (!existingSnapshot.empty) {
        toast({
          title: "Duplicate Entry",
          description: `A water reading for ${client.clientName} for ${data.billingMonth} ${data.billingYear} already exists.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const waterReadingData: Omit<WaterReadingEntry, 'id' | 'createdAt'> = {
        clientId: client.id,
        clientName: client.clientName,
        stallNo: client.stallNo,
        waterMeterNo: client.waterMeterNo,
        dateBilled: Timestamp.fromDate(data.dateBilled),
        billingMonth: data.billingMonth,
        billingYear: data.billingYear,
        previousReading: data.previousReading,
        presentReading: data.presentReading,
        totalM3: data.presentReading - data.previousReading,
        notes: data.notes || "",
      };

      await addDoc(collection(db, "water-readings"), {
        ...waterReadingData,
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Water Reading Saved",
        description: `Reading for ${client.clientName} for ${data.billingMonth} ${data.billingYear} saved.`,
      });
      form.reset({
        dateBilled: new Date(),
        clientId: "",
        billingMonth: MONTHS[new Date().getMonth()],
        billingYear: new Date().getFullYear(),
        previousReading: 0,
        presentReading: 0,
        notes: "",
      });
      setSelectedClientInfo(null);
    } catch (error) {
      console.error("Error saving water reading: ", error);
      toast({
        title: "Error",
        description: "Failed to save water reading. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Water Management" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Record New Water Reading</CardTitle>
            <CardDescription>Enter the water meter reading details for a client.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="dateBilled"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date Billed</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Client</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingClients}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={isLoadingClients ? "Loading clients..." : "Select a client"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {!isLoadingClients && clients.length === 0 && <SelectItem value="no-clients" disabled>No clients found</SelectItem>}
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.clientName} ({client.stallNo})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {selectedClientId && selectedClientInfo && (
                  <Card className="bg-muted/50 p-4">
                    <CardHeader className="p-0 pb-2">
                       <CardTitle className="text-lg flex items-center"><Info className="mr-2 h-5 w-5 text-primary" />Client Details</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <p><span className="font-medium">Stall No:</span> {selectedClientInfo.stallNo}</p>
                      <p><span className="font-medium">Water Meter No:</span> {selectedClientInfo.waterMeterNo}</p>
                      
                      {isLoadingLatestReading && (
                        <div className="md:col-span-2 mt-2 space-y-1">
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                      )}
                      {!isLoadingLatestReading && selectedClientInfo.latestReading === undefined && (
                         <p className="md:col-span-2 text-muted-foreground italic mt-1">Fetching latest reading...</p>
                      )}
                      {!isLoadingLatestReading && selectedClientInfo.latestReading === null && (
                         <p className="md:col-span-2 text-muted-foreground italic mt-1">No previous readings found for this client.</p>
                      )}
                      {!isLoadingLatestReading && selectedClientInfo.latestReading && (
                        <>
                          <p className="md:col-span-2 mt-2 pt-2 border-t border-muted-foreground/20">
                            <span className="font-medium flex items-center"><History className="mr-1 h-4 w-4 text-primary/80" />Latest Recorded Period:</span> {selectedClientInfo.latestReading.period}
                          </p>
                          <p><span className="font-medium">Latest Date Billed:</span> {selectedClientInfo.latestReading.dateBilled}</p>
                          <p><span className="font-medium">Latest Total m³:</span> {selectedClientInfo.latestReading.totalM3.toLocaleString()} m³</p>
                          <p><span className="font-medium">Latest Previous:</span> {selectedClientInfo.latestReading.previousReading.toLocaleString()} m³</p>
                          <p><span className="font-medium">Latest Present:</span> {selectedClientInfo.latestReading.presentReading.toLocaleString()} m³</p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-md">
                  <legend className="text-sm font-medium px-1">Billing Period</legend>
                  <FormField
                    control={form.control}
                    name="billingMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Month</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select month" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MONTHS.map((month) => (
                              <SelectItem key={month} value={month}>
                                {month}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="YYYY" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </fieldset>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="previousReading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Previous Reading (m³)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 12000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="presentReading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Present Reading (m³)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel>Total Consumption (m³)</FormLabel>
                    <Input type="number" value={totalM3} readOnly className="bg-muted/80 font-semibold" />
                  </FormItem>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="max-w-lg">
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any relevant notes about this reading..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingClients}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Water Reading
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Water Consumption History</CardTitle>
            <CardDescription>View past water readings and usage trends for clients.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center bg-muted/30 rounded-md">
            <Image 
              src="https://placehold.co/500x250.png" 
              alt="Water History Chart Placeholder" 
              width={500} 
              height={250}
              data-ai-hint="water history"
              className="rounded-md"
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
