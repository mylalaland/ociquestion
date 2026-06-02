import { GoogleGenerativeAI, SchemaType, ResponseSchema, Part } from "@google/generative-ai";
import { QuizQuestion, QuizResult } from "./types";

const QUIZ_SCHEMA: ResponseSchema = {
  description: "A list of quiz questions generated from a document",
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    extractedText: { type: SchemaType.STRING, description: "If the user provided images, perfectly transcribe all Korean and English text verbatim from the images here to provide the source context." },
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          type: { type: SchemaType.STRING, enum: ["CSAT", "MULTIPLE_CHOICE", "SHORT_ANSWER", "ESSAY", "TRUE_FALSE"] } as ResponseSchema,
          question: { type: SchemaType.STRING },
          passage: { type: SchemaType.STRING, description: "For CSAT type: the reading passage that students must read before answering. REQUIRED for CSAT type." },
          options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          correctAnswer: { type: SchemaType.STRING },
          explanation: { type: SchemaType.STRING },
          sourceContext: { type: SchemaType.STRING },
        },
        required: ["id", "type", "question", "correctAnswer", "explanation", "sourceContext"],
      },
    },
  },
  required: ["title", "summary", "questions"],
};

export class GeminiProvider {
  private genAI: GoogleGenerativeAI;
  private modelId: string;

  constructor(apiKey: string, modelId: string = "gemini-1.5-flash") {
    const sanitizedKey = apiKey.trim().replace(/[^\x20-\x7E]/g, '');
    this.genAI = new GoogleGenerativeAI(sanitizedKey);
    this.modelId = modelId.trim();
  }

  async testConnection(): Promise<boolean> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelId });
      const result = await model.generateContent("Hi");
      const response = await result.response;
      return !!response.text();
    } catch (error) {
      console.error("Gemini Connection Test Failed:", error);
      throw error;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const sanitizedKey = this.genAI.apiKey;
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${sanitizedKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "모델 목록을 가져오지 못했습니다.");
      }
      const data = await response.json();
      return (data.models as { name: string; supportedGenerationMethods: string[] }[])
        .filter((m) => m.supportedGenerationMethods.includes("generateContent"))
        .map((m) => m.name.replace("models/", ""));
    } catch (error) {
      console.error("Discovery Failed:", error);
      throw error;
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error;
        const err = error as { message?: string; status?: number };
        const isRetryable = err.message?.includes("503") || err.message?.includes("429") || err.status === 503 || err.status === 429;
        if (isRetryable && i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
          console.warn(`Retry attempt ${i + 1} after ${delay}ms due to: ${err.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async generateQuiz(
    text: string, 
    types: string[], 
    files?: File[], 
    numQuestions: number = 5, 
    difficulty: string = "보통",
    multipleChoiceCount: number = 5
  ): Promise<QuizResult> {
    return this.withRetry(async () => {
      const model = this.genAI.getGenerativeModel({
        model: this.modelId,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: QUIZ_SCHEMA,
        },
      });

      const prompt = `
        Analyze the provided content and generate a quiz with EXACTLY ${numQuestions} questions. 
        The content may be provided as text below and/or as one or more accompanying images.
        The overall difficulty of the questions should be: [${difficulty}].
        The quiz should include the following types as evenly distributed as possible: ${types.join(", ")}.
        
        ===== CRITICAL RULES (MUST FOLLOW) =====
        
        1. For "MULTIPLE_CHOICE" (객관식):
           - Create ${multipleChoiceCount}-option multiple choice questions.
           - The "correctAnswer" field MUST be the EXACT same string as one of the items in the "options" array. Not a number, not a prefix—the exact option text.
           - There MUST be exactly ONE correct answer among the options. Never create questions where all options are correct or no option is correct.
           - Each option must be clearly distinct and different.
        
        2. For "CSAT" (수능형):
           - You MUST include a "passage" field containing a reading passage (지문) that students read before answering. 
           - The passage must be substantial (at least 3-4 sentences) and directly relevant to the question.
           - NEVER create a CSAT question without a passage. A CSAT question without a passage is INVALID.
           - If the question has options, the correctAnswer MUST exactly match one of the option strings.
        
        3. For "TRUE_FALSE" (O/X):
           - Create statements that are either true or false.
           - The correctAnswer MUST be exactly "O" (true) or "X" (false).
           - Do NOT include options array for TRUE_FALSE questions.
        
        4. For "SHORT_ANSWER" (단답형):
           - Create questions where the answer is a specific word or short phrase (1~3 words max).
        
        5. For "ESSAY" (서술형):
           - Create questions that require a longer, explanatory answer (1~3 sentences).
           - The correctAnswer should be a model answer.
        
        6. For EVERY question:
           - "sourceContext" must accurately quote the exact sentence or paragraph from the text that provides/supports the answer.
           - "explanation" must explain WHY the answer is correct with clear reasoning.
           - All content must be in Korean as the target users are Korean students.
           - Each question "id" must be unique (use q1, q2, q3...).
        
        ===== END RULES =====

        Text provided (extracted from PDF or manually):
        ${text.slice(0, 30000)}
      `;

      const parts: Part[] = [{ text: prompt }];

      if (files && files.length > 0) {
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            const base64Data = await this.fileToGenerativePart(file);
            parts.push(base64Data);
          }
        }
      }

      const result = await model.generateContent(parts);
      const response = await result.response;
      const parsed = JSON.parse(response.text()) as QuizResult;
      
      // Post-process: validate and fix common issues
      parsed.questions = parsed.questions.map(q => {
        // Fix MULTIPLE_CHOICE: ensure correctAnswer matches an option
        if ((q.type === 'MULTIPLE_CHOICE' || q.type === 'CSAT') && q.options && q.options.length > 0) {
          const exactMatch = q.options.find(opt => opt === q.correctAnswer);
          if (!exactMatch) {
            // Try to find by normalized comparison
            const normalize = (s: string) => s.replace(/^(\d+[\.\s]|\d+번\s*|[\(\[\{]\d+[\)\]\}]\s*|[①②③④⑤]\s*)/, '').replace(/[\s\p{P}]/gu, '');
            const normCorrect = normalize(q.correctAnswer);
            const matchIdx = q.options.findIndex(opt => normalize(opt) === normCorrect || normalize(opt).includes(normCorrect) || normCorrect.includes(normalize(opt)));
            if (matchIdx >= 0) {
              q.correctAnswer = q.options[matchIdx];
            } else {
              // Try number-based matching
              const numMatch = q.correctAnswer.match(/(\d+)/);
              if (numMatch) {
                const idx = parseInt(numMatch[1], 10) - 1;
                if (idx >= 0 && idx < q.options.length) {
                  q.correctAnswer = q.options[idx];
                }
              }
            }
          }
        }
        
        // Fix TRUE_FALSE: normalize answer
        if (q.type === 'TRUE_FALSE') {
          const ans = q.correctAnswer.trim().toUpperCase();
          if (ans.includes('O') || ans.includes('TRUE') || ans.includes('맞') || ans.includes('참')) {
            q.correctAnswer = 'O';
          } else {
            q.correctAnswer = 'X';
          }
          q.options = undefined; // Remove any options
        }
        
        return q;
      });
      
      return parsed;
    });
  }

  private async fileToGenerativePart(file: File) {
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });
    
    return {
      inlineData: {
        data: base64Data,
        mimeType: file.type,
      },
    };
  }
}
