
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import type { ClientDocument } from "@/types";
import { Loader2, Save, ScanLine } from "lucide-react";

// Define the schema for client form data
const clientFormSchema = z.object({
  stallNo: z.string().min(1, "Stall No. is required"),
  clientName: z.string().min(1, "Client Name is required"),
  businessName: z.string().min(1, "Business Name is required"),
  waterMeterNo: z.string().min(1, "Water Meter No. is required"),
  powerMeterNo: z.string().min(1, "Power Meter No. is required"),
});
type ClientFormData = z.infer<typeof clientFormSchema>;

interface EditClientModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  client: ClientDocument | null;
}

export function EditClientModal({ isOpen, onOpenChange, client }: EditClientModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (client && isOpen) { // Ensure form is reset only when modal opens with a client
      form.reset({
        stallNo: client.stallNo,
        clientName: client.clientName,
        businessName: client.businessName,
        waterMeterNo: client.waterMeterNo,
        powerMeterNo: client.powerMeterNo,
      });
    }
  }, [client, form, isOpen]);

  async function onSubmit(data: ClientFormData) {
    if (!client || !client.id) {
      toast({
        title: "Error",
        description: "No client selected for editing or client ID is missing.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const clientRef = doc(db, "clients", client.id);
      await updateDoc(clientRef, data); // Only pass data to update, not client.id or createdAt
      toast({
        title: "Client Updated",
        description: `Client ${data.clientName} has been updated successfully.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating client: ", error);
      toast({
        title: "Update Failed",
        description: "Failed to update client. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Client Details</DialogTitle>
          <DialogDescription>
            Make changes to the client's information below. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
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
                <FormItem className="max-w-md">
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
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
