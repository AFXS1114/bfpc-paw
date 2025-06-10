
"use client";

import { useState, useEffect } from "react";
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import type { VerifierDocument } from "@/types";
import { format } from "date-fns";

interface ViewVerifiersModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ViewVerifiersModal({ isOpen, onOpenChange }: ViewVerifiersModalProps) {
  const { toast } = useToast();
  const [verifiers, setVerifiers] = useState<VerifierDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setVerifiers([]); 
      return;
    }

    setIsLoading(true);
    const verifiersQuery = query(collection(db, "verifiers"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(verifiersQuery, (querySnapshot) => {
      const verifiersData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date(),
        } as VerifierDocument;
      });
      setVerifiers(verifiersData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching 'Checked by' personnel: ", error);
      toast({
        title: "Error",
        description: "Failed to fetch 'Checked by' personnel.",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>View 'Checked by' Personnel</DialogTitle>
          <DialogDescription>
            List of all personnel designated for checking and verification.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] py-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : verifiers.length === 0 ? (
            <p className="text-center text-muted-foreground">No 'Checked by' personnel found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Added On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifiers.map((verifier) => (
                  <TableRow key={verifier.id}>
                    <TableCell className="font-medium">{verifier.name}</TableCell>
                    <TableCell>{verifier.designation}</TableCell>
                    <TableCell>
                      {verifier.createdAt ? format(new Date(verifier.createdAt), "MMM dd, yyyy, hh:mm a") : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
