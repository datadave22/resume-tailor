import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  FileText, 
  Sparkles, 
  Upload, 
  Target, 
  ArrowRight, 
  CheckCircle2,
  Zap,
  Shield
} from "lucide-react";

const features = [
  {
    icon: <Upload className="h-6 w-6" />,
    title: "Upload Your Resume",
    description: "Simply upload your existing resume in PDF or DOCX format.",
  },
  {
    icon: <Target className="h-6 w-6" />,
    title: "Choose Your Target",
    description: "Select your target industry and desired job role.",
  },
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: "AI Optimization",
    description: "Our AI tailors your resume to highlight relevant skills.",
  },
];

const benefits = [
  "3 free resume revisions to get started",
  "AI-powered keyword optimization",
  "Industry-specific formatting",
  "Instant results in seconds",
  "Secure and private",
  "No subscription required",
];

export default function LandingPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-primary rounded-md sm:rounded-lg">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm sm:text-lg">ResumeTailor</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button size="sm" onClick={login} data-testid="button-login">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="py-12 sm:py-20 md:py-32">
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6">
              <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              AI-Powered Resume Optimization
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 max-w-3xl mx-auto leading-tight">
              Tailor Your Resume for{" "}
              <span className="text-primary">Any Job</span>
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto">
              Upload your resume and let AI optimize it for your target industry and role. 
              Stand out to recruiters with a perfectly tailored resume.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-lg px-8" onClick={login} data-testid="button-get-started">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Sign in with Google, GitHub, or email. 3 free revisions included.
            </p>
          </div>
        </section>

        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {features.map((feature, index) => (
                <Card key={feature.title} className="relative">
                  <CardContent className="pt-6 text-center">
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto mb-4 mt-4">
                      {feature.icon}
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl font-bold mb-6">Why Choose ResumeTailor?</h2>
                  <p className="text-muted-foreground mb-8">
                    Our AI analyzes your resume and optimizes it for specific industries and roles, 
                    ensuring you highlight the most relevant skills and experiences.
                  </p>
                  <ul className="space-y-3">
                    {benefits.map((benefit) => (
                      <li key={benefit} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-8">
                  <div className="bg-card rounded-lg p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-primary rounded-lg">
                        <FileText className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">resume_tailored.pdf</p>
                        <p className="text-sm text-muted-foreground">Optimized for: Software Engineer</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-primary/30 rounded-full w-full" />
                      <div className="h-2 bg-primary/20 rounded-full w-4/5" />
                      <div className="h-2 bg-primary/20 rounded-full w-3/4" />
                      <div className="h-2 bg-primary/10 rounded-full w-5/6" />
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm text-primary">
                      <Sparkles className="h-4 w-4" />
                      <span>AI-optimized content</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-primary/5">
          <div className="container mx-auto px-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-medium">Secure & Private</span>
            </div>
            <h2 className="text-3xl font-bold mb-4">Ready to Stand Out?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of job seekers who've improved their resumes with ResumeTailor.
            </p>
            <Button size="lg" className="text-lg px-8" onClick={login} data-testid="button-cta">
              Start Tailoring Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary rounded">
                <FileText className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">ResumeTailor</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-powered resume optimization for your dream job.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
