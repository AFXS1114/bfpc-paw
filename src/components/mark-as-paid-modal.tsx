
"use client";

import { useState, useEffect } from "react";
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
import type { InvoiceRecordDocument } from "@/types";
import { Loader2, CheckCircle, Receipt } from "lucide-react";

const markAsPaidFormSchema = z.object({
  orNumber: z.string().min(1, "Official Receipt number is required."),
});

type MarkAsPaidFormData = z.infer<typeof markAsPaidFormSchema>;

interface MarkAsPaidModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  invoice: InvoiceRecordDocument | null;
  onConfirm: (invoiceId: string, orNumber: string) => Promise<void>;
}

export function MarkAsPaidModal({ isOpen, onOpenChange, invoice, onConfirm }: MarkAsPaidModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MarkAsPaidFormData>({
    resolver: zodResolver(markAsPaidFormSchema),
    defaultValues: {
      orNumber: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ orNumber: "" }); // Reset form when modal opens
    }
  }, [isOpen, form]);

  async function onSubmit(data: MarkAsPaidFormData) {
    if (!invoice || !invoice.id) {
      toast({ title: "Error", description: "No invoice selected.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm(invoice.id, data.orNumber);
      toast({
        title: "Invoice Marked as Paid",
        description: `Invoice ${invoice.invoiceNumber} updated successfully.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error marking invoice as paid: ", error);
      toast({
        title: "Update Failed",
        description: "Could not mark invoice as paid. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mark Invoice as Paid</DialogTitle>
          <DialogDescription>
            Enter the Official Receipt (O.R.) number for invoice <span className="font-semibold">{invoice.invoiceNumber}</span>.
            <br/>Client: <span className="font-medium">{invoice.clientName} ({invoice.stallNo})</span>
            <br/>Amount Due: <span className="font-medium">₱{invoice.totalAmountDue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="orNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <Receipt className="mr-2 h-4 w-4 text-muted-foreground" />
                    Official Receipt Number
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Enter O.R. number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Confirm Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
