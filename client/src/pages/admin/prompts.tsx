import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin-layout";
import { 
  Play,
  Save,
  Check,
  Loader2,
} from "lucide-react";

interface PromptVersion {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  userPromptTemplate: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

interface PromptDefaults {
  systemPrompt: string;
  userPromptTemplate: string;
}

export default function AdminPromptsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPromptTemplate, setUserPromptTemplate] = useState("");
  const [testInput, setTestInput] = useState("");
  const [targetIndustry, setTargetIndustry] = useState("Technology");
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [testOutput, setTestOutput] = useState("");
  const [promptName, setPromptName] = useState("");

  const { data: prompts, isLoading: promptsLoading } = useQuery<PromptVersion[]>({
    queryKey: ["/api/admin/prompts"],
  });

  const { data: defaults, isLoading: defaultsLoading } = useQuery<PromptDefaults>({
    queryKey: ["/api/admin/prompts/defaults"],
  });

  useEffect(() => {
    if (defaults && !systemPrompt) {
      setSystemPrompt(defaults.systemPrompt);
      setUserPromptTemplate(defaults.userPromptTemplate);
    }
  }, [defaults]);

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/prompts/test", {
        systemPrompt,
        userPromptTemplate,
        testInput,
        targetIndustry,
        targetRole,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setTestOutput(data.output);
      toast({ 
        title: "Test completed", 
        description: `Execution time: ${data.executionTimeMs}ms` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/prompts", {
        name: promptName,
        systemPrompt,
        userPromptTemplate,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts"] });
      toast({ title: "Prompt saved successfully" });
      setPromptName("");
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/prompts/${id}/activate`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts"] });
      toast({ title: "Prompt activated for production" });
    },
    onError: (error: Error) => {
      toast({ title: "Activation failed", description: error.message, variant: "destructive" });
    },
  });

  const loadPrompt = (prompt: PromptVersion) => {
    setSystemPrompt(prompt.systemPrompt);
    setUserPromptTemplate(prompt.userPromptTemplate);
    toast({ title: `Loaded: ${prompt.name}` });
  };

  const loadDefaults = () => {
    if (defaults) {
      setSystemPrompt(defaults.systemPrompt);
      setUserPromptTemplate(defaults.userPromptTemplate);
      toast({ title: "Loaded default prompts" });
    }
  };

  return (
    <AdminLayout activeNav="prompts">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Prompt Testing</h1>
        <p className="text-muted-foreground text-sm sm:text-base">Test and optimize AI prompts without affecting production.</p>
      </div>

      <Tabs defaultValue="editor" className="space-y-4 sm:space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="editor" className="flex-1 sm:flex-initial">Prompt Editor</TabsTrigger>
          <TabsTrigger value="versions" className="flex-1 sm:flex-initial">Saved Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">System Prompt</CardTitle>
                <CardDescription className="text-xs sm:text-sm">The AI's personality and instructions</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Enter system prompt..."
                  className="min-h-[200px] sm:min-h-[300px] font-mono text-xs sm:text-sm"
                  data-testid="textarea-system-prompt"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={loadDefaults}
                  disabled={defaultsLoading}
                >
                  Load Defaults
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">User Prompt Template</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Use {"{{targetIndustry}}"}, {"{{targetRole}}"}, {"{{resumeText}}"} as variables
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <Textarea
                  value={userPromptTemplate}
                  onChange={(e) => setUserPromptTemplate(e.target.value)}
                  placeholder="Enter user prompt template..."
                  className="min-h-[200px] sm:min-h-[300px] font-mono text-xs sm:text-sm"
                  data-testid="textarea-user-prompt"
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Test Configuration</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Configure test parameters and input</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Industry</Label>
                  <Input
                    value={targetIndustry}
                    onChange={(e) => setTargetIndustry(e.target.value)}
                    placeholder="e.g., Technology"
                    data-testid="input-target-industry"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Role</Label>
                  <Input
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g., Software Engineer"
                    data-testid="input-target-role"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Test Resume Input</Label>
                <Textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Paste a sample resume text here to test..."
                  className="min-h-[120px] sm:min-h-[150px]"
                  data-testid="textarea-test-input"
                />
              </div>
              <Button
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !testInput || !systemPrompt}
                data-testid="button-run-test"
              >
                {testMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running Test...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Test
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {testOutput && (
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Test Output</CardTitle>
                <CardDescription className="text-xs sm:text-sm">AI-generated result</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed bg-muted/30 p-3 sm:p-4 rounded-lg max-h-[300px] sm:max-h-[400px] overflow-auto">
                  {testOutput}
                </pre>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Save Prompt Version</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Save this prompt for later use or activation</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Input
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
                placeholder="Version name (e.g., v2.0-gamified)"
                className="flex-1"
                data-testid="input-prompt-name"
              />
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !promptName || !systemPrompt}
                className="w-full sm:w-auto"
                data-testid="button-save-prompt"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Version
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions">
          <Card>
            <CardHeader>
              <CardTitle>Saved Prompt Versions</CardTitle>
              <CardDescription>Manage and activate prompt versions</CardDescription>
            </CardHeader>
            <CardContent>
              {promptsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : prompts && prompts.length > 0 ? (
                <div className="space-y-3">
                  {prompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-sm sm:text-base">{prompt.name}</span>
                          {prompt.isActive && (
                            <Badge variant="default" className="bg-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                          {prompt.isDefault && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Created: {new Date(prompt.createdAt).toLocaleDateString()}
                          {prompt.description && ` - ${prompt.description}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadPrompt(prompt)}
                          data-testid={`button-load-${prompt.id}`}
                        >
                          Load
                        </Button>
                        {!prompt.isActive && (
                          <Button
                            size="sm"
                            onClick={() => activateMutation.mutate(prompt.id)}
                            disabled={activateMutation.isPending}
                            data-testid={`button-activate-${prompt.id}`}
                          >
                            Activate
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No saved prompt versions yet. Create one in the Prompt Editor tab.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
