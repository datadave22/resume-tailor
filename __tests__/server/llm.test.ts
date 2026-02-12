import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock storage before importing llm
const mockStorage = {
  getActivePromptVersion: vi.fn(),
  getDefaultPromptVersion: vi.fn(),
};

vi.mock("../../server/storage", () => ({
  storage: mockStorage,
}));

// Mock OpenAI
const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
    constructor(_opts?: any) {}
  },
}));

// Import after mocks are set up
const { tailorResume, testPrompt, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT_TEMPLATE } =
  await import("../../server/llm");

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════
// tailorResume
// ═══════════════════════════════════════════════════

describe("tailorResume", () => {
  const sampleResume = "John Doe\nSoftware Engineer\n5 years React experience";
  const targetIndustry = "FinTech";
  const targetRole = "Senior Frontend Engineer";

  it("calls OpenAI with default prompts when no active version exists", async () => {
    mockStorage.getActivePromptVersion.mockResolvedValue(undefined);
    mockStorage.getDefaultPromptVersion.mockResolvedValue(undefined);

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Tailored resume content" } }],
    });

    const result = await tailorResume(sampleResume, targetIndustry, targetRole);

    expect(result.content).toBe("Tailored resume content");
    expect(result.promptVersionId).toBeUndefined();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        max_tokens: 4096,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
      }),
    );
  });

  it("uses active prompt version from database", async () => {
    const activePrompt = {
      id: "prompt_v2",
      systemPrompt: "Custom system prompt",
      userPromptTemplate: "Custom template: {{resumeText}} for {{targetRole}} in {{targetIndustry}}",
    };
    mockStorage.getActivePromptVersion.mockResolvedValue(activePrompt);

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Custom tailored content" } }],
    });

    const result = await tailorResume(sampleResume, targetIndustry, targetRole);

    expect(result.content).toBe("Custom tailored content");
    expect(result.promptVersionId).toBe("prompt_v2");

    // Verify the custom template was used with variables replaced
    const userMessage = mockCreate.mock.calls[0][0].messages[1].content;
    expect(userMessage).toContain(sampleResume);
    expect(userMessage).toContain(targetIndustry);
    expect(userMessage).toContain(targetRole);
    expect(userMessage).not.toContain("{{");
  });

  it("falls back to default prompt version when no active version", async () => {
    const defaultPrompt = {
      id: "prompt_default",
      systemPrompt: "Default system",
      userPromptTemplate: "Default: {{resumeText}}",
    };
    mockStorage.getActivePromptVersion.mockResolvedValue(undefined);
    mockStorage.getDefaultPromptVersion.mockResolvedValue(defaultPrompt);

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Default output" } }],
    });

    const result = await tailorResume(sampleResume, targetIndustry, targetRole);

    expect(result.promptVersionId).toBe("prompt_default");
  });

  it("uses provided options over database prompts", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Override output" } }],
    });

    const result = await tailorResume(sampleResume, targetIndustry, targetRole, {
      systemPrompt: "Override system",
      userPromptTemplate: "Override: {{resumeText}}",
    });

    expect(result.content).toBe("Override output");
    // Should NOT query DB when options are provided
    expect(mockStorage.getActivePromptVersion).not.toHaveBeenCalled();
  });

  it("throws when OpenAI returns empty content", async () => {
    mockStorage.getActivePromptVersion.mockResolvedValue(undefined);
    mockStorage.getDefaultPromptVersion.mockResolvedValue(undefined);

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    await expect(
      tailorResume(sampleResume, targetIndustry, targetRole),
    ).rejects.toThrow("Failed to generate tailored resume content");
  });

  it("replaces all template variables correctly", async () => {
    mockStorage.getActivePromptVersion.mockResolvedValue(undefined);
    mockStorage.getDefaultPromptVersion.mockResolvedValue(undefined);

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "output" } }],
    });

    await tailorResume(sampleResume, targetIndustry, targetRole);

    const userMessage = mockCreate.mock.calls[0][0].messages[1].content;
    // The default template uses {{targetIndustry}}, {{targetRole}}, {{resumeText}}
    expect(userMessage).toContain("FinTech");
    expect(userMessage).toContain("Senior Frontend Engineer");
    expect(userMessage).toContain(sampleResume);
    // No unreplaced template variables
    expect(userMessage).not.toContain("{{targetIndustry}}");
    expect(userMessage).not.toContain("{{targetRole}}");
    expect(userMessage).not.toContain("{{resumeText}}");
  });
});

// ═══════════════════════════════════════════════════
// testPrompt
// ═══════════════════════════════════════════════════

describe("testPrompt", () => {
  it("runs a prompt test and returns output with timing", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Test output" } }],
    });

    const result = await testPrompt(
      "System prompt",
      "Template: {{resumeText}} for {{targetRole}} in {{targetIndustry}}",
      "Sample input",
      "Healthcare",
      "Data Analyst",
    );

    expect(result.output).toBe("Test output");
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("returns empty string when OpenAI returns null", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await testPrompt("System", "{{resumeText}}", "Input", "Tech", "Dev");

    expect(result.output).toBe("");
  });
});

// ═══════════════════════════════════════════════════
// Exported constants
// ═══════════════════════════════════════════════════

describe("Default prompts", () => {
  it("exports non-empty default system prompt", () => {
    expect(DEFAULT_SYSTEM_PROMPT).toBeTruthy();
    expect(DEFAULT_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("exports user prompt template with required placeholders", () => {
    expect(DEFAULT_USER_PROMPT_TEMPLATE).toContain("{{resumeText}}");
    expect(DEFAULT_USER_PROMPT_TEMPLATE).toContain("{{targetIndustry}}");
    expect(DEFAULT_USER_PROMPT_TEMPLATE).toContain("{{targetRole}}");
  });
});
