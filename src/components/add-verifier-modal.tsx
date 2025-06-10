
"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import type { VerifierEntry } from "@/types";
import { Loader2, UserCheck, Save } from "lucide-react";

const verifierFormSchema = z.object({
  name: z.string().min(1, "Name is required."),
  designation: z.string().min(1, "Designation is required."),
});

type VerifierFormData = z.infer<typeof verifierFormSchema>;

interface AddVerifierModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AddVerifierModal({ isOpen, onOpenChange }: AddVerifierModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<VerifierFormData>({
    resolver: zodResolver(verifierFormSchema),
    defaultValues: {
      name: "",
      designation: "",
    },
  });

  async function onSubmit(data: VerifierFormData) {
    setIsSubmitting(true);
    try {
      const verifierData: Omit<VerifierEntry, "id" | "createdAt"> & { createdAt: any } = {
        name: data.name,
        designation: data.designation,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "verifiers"), verifierData);

      toast({
        title: "'Checked by' Personnel Added",
        description: `${data.name} has been added successfully.`,
      });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding 'Checked by' personnel: ", error);
      toast({
        title: "Error",
        description: "Failed to add 'Checked by' personnel. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add 'Checked by' Personnel</DialogTitle>
          <DialogDescription>
            Enter the name and designation of the person who checks and verifies records/invoices.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">Role Display</Label>
              <p className="text-sm p-2 border rounded-md bg-muted">Checked and Verified by:</p>
            </div>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Alex Auditor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="designation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Internal Auditor" {...field} />
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
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Personnel
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
