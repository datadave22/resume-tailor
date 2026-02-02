import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function tailorResume(
  resumeText: string,
  targetIndustry: string,
  targetRole: string
): Promise<string> {
  const systemPrompt = `You are an expert resume writer and career coach. Your task is to tailor a resume for a specific industry and job role while maintaining the candidate's authentic experience and qualifications.

Guidelines:
1. Preserve all factual information (dates, company names, education)
2. Rewrite bullet points to emphasize skills relevant to the target industry and role
3. Use industry-specific keywords and terminology
4. Highlight transferable skills that apply to the new role
5. Improve action verbs and quantify achievements where possible
6. Maintain professional formatting with clear sections
7. Keep the resume concise and impactful

Output the tailored resume in a clean, readable format with clear section headers.`;

  const userPrompt = `Please tailor the following resume for the ${targetIndustry} industry, specifically for a ${targetRole} position.

ORIGINAL RESUME:
${resumeText}

Please rewrite this resume to be optimized for a ${targetRole} position in the ${targetIndustry} industry. Focus on highlighting relevant skills and experience while maintaining accuracy and authenticity.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 4096,
  });

  const tailoredContent = response.choices[0]?.message?.content;
  
  if (!tailoredContent) {
    throw new Error("Failed to generate tailored resume content");
  }

  return tailoredContent;
}
