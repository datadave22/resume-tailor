import OpenAI from "openai";
import { storage } from "./storage";
import env from "../config/env.js";

const openai = new OpenAI({
  apiKey: env.openai.apiKey,
  baseURL: env.openai.baseURL,
});

// Premium gamified resume coach prompt (default)
const DEFAULT_SYSTEM_PROMPT = `You are a high-performance resume coach with a subtle, premium gamified layer.
Your job is to help create a clear, powerful, job-winning resume while making the process feel smooth, motivating, and rewarding — similar to the emotional feedback of a great product, not a game show.

You are:
- Confident, precise, and encouraging
- A coach who celebrates real progress
- Never corny, never juvenile, never distracting
- Resume quality always comes first

Core Tone & Style:
- Calm confidence > hype
- Encouraging and slightly playful
- Feels like a coach + performance analyst
- Gamification is light, earned, and intentional

Guidelines:
1. Preserve all factual information (dates, company names, education)
2. Rewrite bullet points to emphasize skills relevant to the target industry and role
3. Use industry-specific keywords and terminology
4. Highlight transferable skills that apply to the new role
5. Improve action verbs and quantify achievements where possible
6. Maintain professional formatting with clear sections
7. Keep the resume concise and impactful

Progression Framing (The "10-Pack Zone"):
Treat resume strength as a progression, not a grind. The output should reflect these principles:
- Clear ownership of accomplishments
- Quantified impact where possible
- Sharper, more powerful language
- Strong structure and flow

Output the tailored resume in a clean, readable format with clear section headers.
After the resume, add a brief "Coach's Notes" section with:
- 2-3 key improvements made
- One suggestion for the candidate to consider
- An encouraging momentum note

CRITICAL: Never use emojis in the resume output itself. Keep gamification elements in the Coach's Notes only.`;

const DEFAULT_USER_PROMPT_TEMPLATE = `Please tailor the following resume for the {{targetIndustry}} industry, specifically for a {{targetRole}} position.

ORIGINAL RESUME:
{{resumeText}}

Transform this resume to be optimized for a {{targetRole}} position in the {{targetIndustry}} industry. Focus on:
1. Highlighting relevant skills and experience
2. Using industry-specific terminology
3. Quantifying achievements where possible
4. Maintaining authenticity while maximizing impact

Make every bullet count. Show ownership and results.`;

export interface TailorOptions {
  systemPrompt?: string;
  userPromptTemplate?: string;
}

export async function tailorResume(
  resumeText: string,
  targetIndustry: string,
  targetRole: string,
  options?: TailorOptions
): Promise<{ content: string; promptVersionId?: string }> {
  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  let userPromptTemplate = DEFAULT_USER_PROMPT_TEMPLATE;
  let promptVersionId: string | undefined;

  // Try to get active prompt version from database
  if (!options?.systemPrompt) {
    const activePrompt = await storage.getActivePromptVersion();
    if (activePrompt) {
      systemPrompt = activePrompt.systemPrompt;
      userPromptTemplate = activePrompt.userPromptTemplate;
      promptVersionId = activePrompt.id;
    } else {
      // Fall back to default prompt
      const defaultPrompt = await storage.getDefaultPromptVersion();
      if (defaultPrompt) {
        systemPrompt = defaultPrompt.systemPrompt;
        userPromptTemplate = defaultPrompt.userPromptTemplate;
        promptVersionId = defaultPrompt.id;
      }
    }
  } else {
    systemPrompt = options.systemPrompt;
    userPromptTemplate = options.userPromptTemplate || DEFAULT_USER_PROMPT_TEMPLATE;
  }

  // Replace template variables
  const userPrompt = userPromptTemplate
    .replace(/\{\{targetIndustry\}\}/g, targetIndustry)
    .replace(/\{\{targetRole\}\}/g, targetRole)
    .replace(/\{\{resumeText\}\}/g, resumeText);

  const startTime = Date.now();
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 4096,
  });

  const executionTimeMs = Date.now() - startTime;

  const tailoredContent = response.choices[0]?.message?.content;
  
  if (!tailoredContent) {
    throw new Error("Failed to generate tailored resume content");
  }

  return { 
    content: tailoredContent, 
    promptVersionId 
  };
}

// Test a specific prompt without affecting production
export async function testPrompt(
  systemPrompt: string,
  userPromptTemplate: string,
  testInput: string,
  targetIndustry: string,
  targetRole: string
): Promise<{ output: string; executionTimeMs: number }> {
  const userPrompt = userPromptTemplate
    .replace(/\{\{targetIndustry\}\}/g, targetIndustry)
    .replace(/\{\{targetRole\}\}/g, targetRole)
    .replace(/\{\{resumeText\}\}/g, testInput);

  const startTime = Date.now();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 4096,
  });

  const executionTimeMs = Date.now() - startTime;
  const output = response.choices[0]?.message?.content || "";

  return { output, executionTimeMs };
}

export { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT_TEMPLATE };
