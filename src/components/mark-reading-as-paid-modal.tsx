
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
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import type { PowerReadingDocument, WaterReadingDocument } from "@/types";
import { Loader2, CheckCircle, Receipt } from "lucide-react";

const markAsPaidFormSchema = z.object({
  orNumber: z.string().min(1, "Official Receipt number is required."),
});

type MarkAsPaidFormData = z.infer<typeof markAsPaidFormSchema>;

interface MarkReadingAsPaidModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  reading: PowerReadingDocument | WaterReadingDocument | null;
  utilityType: 'power' | 'water';
}

export function MarkReadingAsPaidModal({ isOpen, onOpenChange, reading, utilityType }: MarkReadingAsPaidModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MarkAsPaidFormData>({
    resolver: zodResolver(markAsPaidFormSchema),
    defaultValues: { orNumber: "" },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ orNumber: "" });
    }
  }, [isOpen, form]);

  async function onSubmit(data: MarkAsPaidFormData) {
    if (!reading || !reading.id) {
      toast({ title: "Error", description: "No reading selected.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const collectionName = utilityType === 'power' ? 'power-readings' : 'water-readings';
    const readingRef = doc(db, collectionName, reading.id);

    try {
      await updateDoc(readingRef, {
        notes: `Paid - OR# ${data.orNumber}`,
      });
      toast({
        title: "Reading Marked as Paid",
        description: `Reading for ${reading.clientName} (${reading.billingMonth} ${reading.billingYear}) has been updated.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error marking reading as paid: ", error);
      toast({
        title: "Update Failed",
        description: "Could not update the reading. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!reading) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mark Reading as Paid</DialogTitle>
          <DialogDescription>
            Enter the Official Receipt (O.R.) number for the reading from <strong>{reading.billingMonth} {reading.billingYear}</strong> for client <strong>{reading.clientName}</strong>. This will update the 'notes' field.
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
