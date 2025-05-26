
// src/app/clients/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { UserPlus, Building, ScanLine, Loader2, ListChecks } from "lucide-react";
import type { Client } from "@/types";

const clientFormSchema = z.object({
  stallNo: z.string().min(1, "Stall No. is required"),
  clientName: z.string().min(1, "Client Name is required"),
  businessName: z.string().min(1, "Business Name is required"),
  waterMeterNo: z.string().min(1, "Water Meter No. is required"),
  powerMeterNo: z.string().min(1, "Power Meter No. is required"),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

interface ClientDocument extends Client {
  id: string;
  createdAt?: Timestamp; // Firestore Timestamp
}

export default function ClientsPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<ClientDocument[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      stallNo: "",
      clientName: "",
      businessName: "",
      waterMeterNo: "",
      powerMeterNo: "",
    },
  });

  useEffect(() => {
    setIsLoadingClients(true);
    const clientsQuery = query(collection(db, "clients"), orderBy("createdAt", "desc"));
    
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

  async function onSubmit(data: ClientFormData) {
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "clients"), {
        ...data,
        createdAt: serverTimestamp(),
      } as Client); // Type assertion for Client without id
      toast({
        title: "Client Added Successfully",
        description: `Client ${data.clientName} has been added.`,
      });
      form.reset();
    } catch (error) {
      console.error("Error adding client: ", error);
      toast({
        title: "Error",
        description: "Failed to add client. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Manage Clients" />
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-primary" />
              Add New Client
            </CardTitle>
            <CardDescription>
              Enter the details of the new client.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="stallNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stall No.</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., A-101" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., John's Groceries" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="waterMeterNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                           <ScanLine className="mr-2 h-4 w-4 text-primary/80" /> Water Meter No.
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., WTR-00123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="powerMeterNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          <ScanLine className="mr-2 h-4 w-4 text-primary/80" /> Power Meter No.
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., PWR-00456" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Save Client
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-6 w-6 text-primary" />
              Client Records
            </CardTitle>
            <CardDescription>
              List of all registered clients.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingClients ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : clients.length === 0 ? (
              <p className="text-muted-foreground text-center">No clients found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stall No.</TableHead>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Water Meter No.</TableHead>
                    <TableHead>Power Meter No.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>{client.stallNo}</TableCell>
                      <TableCell>{client.clientName}</TableCell>
                      <TableCell>{client.businessName}</TableCell>
                      <TableCell>{client.waterMeterNo}</TableCell>
                      <TableCell>{client.powerMeterNo}</TableCell>
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
