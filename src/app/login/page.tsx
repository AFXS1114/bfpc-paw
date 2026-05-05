"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import type { AppUserDocument } from "@/types";
import { Mail, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { AppLogo } from "@/components/app-logo";

const emailSchema = z.object({
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
});

const passcodeSchema = z.object({
  passcode: z.string().min(1, "Passcode is required."),
});

type EmailFormData = z.infer<typeof emailSchema>;
type PasscodeFormData = z.infer<typeof passcodeSchema>;

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "passcode">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUser, setIsFetchingUser] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [storedUser, setStoredUser] = useState<AppUserDocument | null>(null);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const passcodeForm = useForm<PasscodeFormData>({
    resolver: zodResolver(passcodeSchema),
    defaultValues: { passcode: "" },
  });

  const fetchUserByEmail = async (email: string): Promise<AppUserDocument | null> => {
    const usersRef = collection(db, "app-users");
    const q = query(usersRef, where("email", "==", email), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      toast({
        title: "Email Not Found",
        description: "The provided email address is not registered.",
        variant: "destructive",
      });
      return null;
    }
    const userDocData = querySnapshot.docs[0].data();
    return { id: querySnapshot.docs[0].id, ...userDocData } as AppUserDocument;
  };


  const handleEmailSubmit = async (data: EmailFormData) => {
    if (typeof window === 'undefined') return;
    setIsLoading(true);
    const trimmedEmail = data.email.trim();
    setSubmittedEmail(trimmedEmail);

    const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
    const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

    try {
      const userDoc = await fetchUserByEmail(trimmedEmail);
      if (!userDoc) {
        setIsLoading(false);
        return;
      }
      setStoredUser(userDoc);

      if (!serviceId || !templateId || !publicKey) {
        toast({ title: "Configuration Error", description: "Email service is not configured. Use the link below to enter passcode directly.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Dynamic import of emailjs to avoid SSR issues
      const emailjs = await import("@emailjs/browser");
      await emailjs.send(serviceId, templateId, {
        to_email: trimmedEmail,
        user_name: userDoc.name,
        passcode: userDoc.passcode,
      }, publicKey);

      toast({ title: "Passcode Sent", description: "A passcode has been sent to your email address." });
      setStep("passcode");
    } catch (error: any) {
      console.error("Login email error:", error);
      toast({ title: "Error", description: "Failed to send email. You can try entering your passcode directly.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectPasscodeEntry = async () => {
    const emailIsValid = await emailForm.trigger("email");
    if (!emailIsValid) {
      emailForm.setFocus("email");
      return;
    }
    
    const emailValue = emailForm.getValues("email").trim();
    setIsFetchingUser(true);
    setSubmittedEmail(emailValue);
    try {
        const user = await fetchUserByEmail(emailValue);
        if (user) {
            setStoredUser(user);
            setStep("passcode");
        }
    } catch (error) {
        toast({ title: "Error", description: "Could not fetch user details.", variant: "destructive"});
    } finally {
        setIsFetchingUser(false);
    }
  };


  const handlePasscodeSubmit = (data: PasscodeFormData) => {
    setIsLoading(true);
    if (storedUser && data.passcode === storedUser.passcode) {
      localStorage.setItem("pawUserVerified", "true");
      localStorage.setItem("pawUserRole", storedUser.role);
      localStorage.setItem("pawUserId", storedUser.id);
      localStorage.setItem("pawUserName", storedUser.name);
      toast({ title: "Success", description: "You are now logged in." });
      router.push("/"); 
    } else {
      toast({ title: "Invalid Passcode", variant: "destructive" });
    }
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="items-center text-center">
          <AppLogo className="mb-4" />
          <CardTitle className="text-2xl">Power &amp; Water</CardTitle>
          <CardDescription>
            {step === "email"
              ? "Enter your email to receive a passcode."
              : `Enter the passcode sent to ${submittedEmail}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <Form {...emailForm}>
              <form
                onSubmit={emailForm.handleSubmit(handleEmailSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          {...field}
                          className="text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading || isFetchingUser}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Send Passcode
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm text-muted-foreground hover:text-primary p-0 h-auto"
                  onClick={handleDirectPasscodeEntry}
                  disabled={isLoading || isFetchingUser}
                >
                  Already have a passcode? Enter it directly.
                </Button>
              </form>
            </Form>
          )}

          {step === "passcode" && (
            <Form {...passcodeForm}>
              <form
                onSubmit={passcodeForm.handleSubmit(handlePasscodeSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={passcodeForm.control}
                  name="passcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />
                        Passcode
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Enter passcode"
                          {...field}
                          className="text-base tracking-wider"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Verify Passcode
                </Button>
                <Button
                  variant="link"
                  className="w-full"
                  onClick={() => setStep("email")}
                  disabled={isLoading}
                >
                  Back to email input
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="justify-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} PAW App</p>
        </CardFooter>
      </Card>
    </div>
  );
}
