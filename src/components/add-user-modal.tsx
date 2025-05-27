
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import type { AppUserEntry, AppUserRole } from "@/types";
import { APP_USER_ROLES, APP_USER_ROLE_LABELS } from "@/types";
import { Loader2, UserPlus } from "lucide-react";

const addUserFormSchema = z.object({
  name: z.string().min(1, "Name is required."),
  role: z.enum(APP_USER_ROLES, { required_error: "Role is required." }),
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  // Passcode is removed from form schema as it will be auto-generated
});

type AddUserFormData = z.infer<typeof addUserFormSchema>;

interface AddUserModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

function generatePasscode(length: number = 6): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export function AddUserModal({ isOpen, onOpenChange }: AddUserModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddUserFormData>({
    resolver: zodResolver(addUserFormSchema),
    defaultValues: {
      name: "",
      // role: undefined, // Let placeholder handle it
      email: "",
    },
  });

  async function onSubmit(data: AddUserFormData) {
    setIsSubmitting(true);
    const generatedPasscode = generatePasscode(6);
    try {
      const appUserData: Omit<AppUserEntry, "id" | "createdAt"> & { createdAt: any } = {
        name: data.name,
        role: data.role,
        email: data.email,
        passcode: generatedPasscode,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "app-users"), appUserData);

      toast({
        title: "App User Added",
        description: `User ${data.name} has been added. Generated Passcode: ${generatedPasscode}`,
        duration: 9000, // Allow more time to copy the passcode
      });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding app user: ", error);
      toast({
        title: "Error",
        description: "Failed to add app user. Please try again.",
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
          <DialogTitle>Add New App User</DialogTitle>
          <DialogDescription>
            Enter the details for the new application user. A 6-character alphanumeric passcode will be auto-generated. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {APP_USER_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {APP_USER_ROLE_LABELS[role]}
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="e.g., user@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="text-sm text-muted-foreground pt-1">
              <p>A 6-character alphanumeric passcode will be automatically generated and displayed upon successful submission.</p>
              <p className="text-xs mt-1">
                Note: Passcode renewal logic upon logout is not yet implemented.
              </p>
            </div>
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
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Save User
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
