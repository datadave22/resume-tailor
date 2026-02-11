import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getAuthHeaders } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  FileText, 
  Upload, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  File,
  X
} from "lucide-react";
import { Link } from "wouter";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

export default function UploadPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const authHeaders = await getAuthHeaders();

      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.message || "Upload failed"));
            } catch {
              reject(new Error("Upload failed"));
            }
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.open("POST", "/api/resumes/upload");
        Object.entries(authHeaders).forEach(([key, value]) => xhr.setRequestHeader(key, value));
        xhr.send(formData);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resumes"] });
      toast({
        title: "Resume uploaded",
        description: "Your resume has been uploaded and processed successfully.",
      });
      setLocation("/tailor");
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Please upload a PDF or DOCX file";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size must be less than 5MB";
    }
    return null;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const error = validateFile(droppedFile);
      if (error) {
        toast({ title: "Invalid file", description: error, variant: "destructive" });
        return;
      }
      setFile(droppedFile);
    }
  }, [toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const error = validateFile(selectedFile);
      if (error) {
        toast({ title: "Invalid file", description: error, variant: "destructive" });
        return;
      }
      setFile(selectedFile);
    }
  }, [toast]);

  const handleUpload = () => {
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploadProgress(0);
  };

  if (!user) return null;

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
              <span className="font-bold text-sm sm:text-lg">ResumeTailor</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8 max-w-2xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-bold mb-2">Upload Your Resume</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Upload your existing resume to get started. We accept PDF and DOCX files up to 5MB.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Resume File
            </CardTitle>
            <CardDescription>
              Drag and drop your file or click to browse
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!file ? (
              <div
                className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  data-testid="input-file"
                />
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-muted rounded-full">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium mb-1">Drop your resume here</p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse (PDF, DOCX - max 5MB)
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded">
                      <File className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={removeFile}
                    disabled={uploadMutation.isPending}
                    data-testid="button-remove-file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {uploadMutation.isPending && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}

                <Button
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending}
                  className="w-full"
                  data-testid="button-upload"
                >
                  {uploadMutation.isPending ? (
                    "Uploading..."
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Resume
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="mt-6 p-4 rounded-lg bg-muted/30">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                What happens next?
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• We'll extract the text from your resume</li>
                <li>• You can then tailor it for specific industries and roles</li>
                <li>• Our AI will optimize your resume for maximum impact</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
