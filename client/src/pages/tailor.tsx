import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiRequest } from "@/lib/queryClient";
import { 
  FileText, 
  Sparkles, 
  ArrowLeft, 
  Loader2,
  AlertCircle,
  CreditCard,
  File
} from "lucide-react";
import type { Resume } from "@shared/schema";

const tailorFormSchema = z.object({
  resumeId: z.string().min(1, "Please select a resume"),
  targetIndustry: z.string().min(1, "Please select an industry"),
  targetRole: z.string().min(1, "Please enter a job role"),
  jobDescription: z.string().optional(),
});

type TailorFormData = z.infer<typeof tailorFormSchema>;

const industries = [
  "Technology",
  "Finance & Banking",
  "Healthcare",
  "Marketing & Advertising",
  "Education",
  "Manufacturing",
  "Retail & E-commerce",
  "Consulting",
  "Legal",
  "Non-profit",
  "Government",
  "Real Estate",
  "Entertainment & Media",
  "Energy & Utilities",
  "Transportation & Logistics",
];

export default function TailorPage() {
  const { user, refetchUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: resumes, isLoading: resumesLoading } = useQuery<Resume[]>({
    queryKey: ["/api/resumes"],
  });

  const form = useForm<TailorFormData>({
    resolver: zodResolver(tailorFormSchema),
    defaultValues: {
      resumeId: "",
      targetIndustry: "",
      targetRole: "",
      jobDescription: "",
    },
  });

  const tailorMutation = useMutation({
    mutationFn: async (data: TailorFormData) => {
      const res = await apiRequest("POST", "/api/revisions/tailor", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/revisions"] });
      refetchUser();
      toast({
        title: "Resume tailored successfully",
        description: "Your optimized resume is ready to view.",
      });
      setLocation(`/revisions/${data.revision.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Tailoring failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  const isSubscribed = user.subscriptionStatus === "active";
  const freeRevisionsLeft = 1 - (user.freeRevisionsUsed || 0);
  const totalRevisionsLeft = freeRevisionsLeft + (user.paidRevisionsRemaining || 0);
  const hasRevisions = isSubscribed || totalRevisionsLeft > 0;

  const onSubmit = (data: TailorFormData) => {
    tailorMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-primary rounded-md sm:rounded-lg">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm sm:text-lg">ResumePolish</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8 max-w-2xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-bold mb-2">Tailor Your Resume</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Select your target industry and role to optimize your resume with AI.
          </p>
        </div>

        {!hasRevisions ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div className="text-center">
                <h3 className="font-semibold text-lg mb-2">No Revisions Left</h3>
                <p className="text-muted-foreground mb-4">
                  You've used all your free revisions. Purchase more to continue tailoring your resume.
                </p>
              </div>
              <Link href="/pricing">
                <Button size="lg" data-testid="button-buy-revisions">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Buy More Revisions
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 p-4 rounded-lg bg-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-medium">Revisions remaining:</span>
              </div>
              <div className="flex items-center gap-2">
                {isSubscribed ? (
                  <>
                    <Badge variant="default">∞</Badge>
                    <span className="text-sm text-muted-foreground">Pro subscriber</span>
                  </>
                ) : (
                  <>
                    <Badge variant="default">{totalRevisionsLeft}</Badge>
                    <span className="text-sm text-muted-foreground">
                      ({freeRevisionsLeft > 0 ? `${freeRevisionsLeft} free` : "paid only"})
                    </span>
                  </>
                )}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Tailor Settings
                </CardTitle>
                <CardDescription>
                  Choose your resume and target industry/role for AI optimization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="resumeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Resume</FormLabel>
                          {resumesLoading ? (
                            <Skeleton className="h-10 w-full" />
                          ) : resumes && resumes.length > 0 ? (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-resume">
                                  <SelectValue placeholder="Choose a resume to tailor" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {resumes.map((resume) => (
                                  <SelectItem key={resume.id} value={resume.id}>
                                    <div className="flex items-center gap-2">
                                      <File className="h-4 w-4" />
                                      {resume.originalFilename}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="p-4 rounded-lg bg-muted text-center">
                              <p className="text-muted-foreground mb-2">No resumes uploaded yet</p>
                              <Link href="/upload">
                                <Button variant="secondary" size="sm">
                                  Upload Resume
                                </Button>
                              </Link>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="targetIndustry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Industry</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-industry">
                                <SelectValue placeholder="Select your target industry" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {industries.map((industry) => (
                                <SelectItem key={industry} value={industry}>
                                  {industry}
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
                      name="targetRole"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Job Role</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Senior Software Engineer, Product Manager"
                              data-testid="input-role"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="jobDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Job Description{" "}
                            <span className="text-muted-foreground font-normal">(Optional — highly recommended)</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Paste the full job posting here. The AI will extract exact keywords, requirements, and company language to tailor your resume specifically to this role."
                              className="min-h-[140px] resize-y text-sm"
                              data-testid="textarea-job-description"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Providing the job posting produces a significantly more targeted result than industry/role alone.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={tailorMutation.isPending || !resumes?.length}
                      data-testid="button-tailor"
                    >
                      {tailorMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Tailoring your resume...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Tailor Resume
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
