
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import emailjs from "emailjs-com";

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
import { Label } from "@/components/ui/label";
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

  const handleEmailSubmit = async (data: EmailFormData) => {
    setIsLoading(true);
    setSubmittedEmail(data.email);

    try {
      const usersRef = collection(db, "app-users");
      const q = query(
        usersRef,
        where("email", "==", data.email),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({
          title: "Email Not Found",
          description: "The provided email address is not registered.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0].data() as AppUserDocument;
      setStoredUser(userDoc);

      // Send email using EmailJS
      const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
      const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

      if (!serviceId || !templateId || !publicKey) {
        console.error("EmailJS environment variables are not set.");
        toast({
          title: "Configuration Error",
          description: "Email sending service is not configured. Please contact support.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const templateParams = {
        to_email: data.email, // Use the email from the form input directly
        user_name: userDoc.name,
        passcode: userDoc.passcode,
      };
      
      await emailjs.send(serviceId, templateId, templateParams, publicKey);

      toast({
        title: "Passcode Sent",
        description: "A passcode has been sent to your email address.",
      });
      setStep("passcode");
    } catch (error: any) {
      console.error("Error during email submission or sending email: ", error);
      let errorMessage = "An error occurred. Please try again.";
      if (error && typeof error === 'object' && 'status' in error && 'text' in error) {
        errorMessage = `Failed to send passcode email. Error: ${error.text} (Status: ${error.status})`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasscodeSubmit = (data: PasscodeFormData) => {
    setIsLoading(true);
    if (storedUser && data.passcode === storedUser.passcode) {
      localStorage.setItem("pawUserVerified", "true");
      toast({
        title: "Verification Successful",
        description: "You are now logged in.",
      });
      router.push("/"); // Redirect to dashboard or main app page
    } else {
      toast({
        title: "Invalid Passcode",
        description: "The entered passcode is incorrect. Please try again.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="items-center text-center">
          <AppLogo className="mb-4" />
          <CardTitle className="text-2xl">PAW App Security</CardTitle>
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
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Send Passcode
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
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                     <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Verify Passcode
                </Button>
                <Button
                  variant="link"
                  className="w-full"
                  onClick={() => {
                    setStep("email");
                    passcodeForm.reset();
                    emailForm.reset({ email: submittedEmail });
                  }}
                  disabled={isLoading}
                >
                  Back to email input
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="justify-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} PAW App. All rights reserved.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
