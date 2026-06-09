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
        
        ===== CRITICAL RULES (MUST FOLLOW — VIOLATION = INVALID OUTPUT) =====
        
        1. For "MULTIPLE_CHOICE" (객관식):
           - Create EXACTLY ${multipleChoiceCount} options.
           - The "correctAnswer" field MUST be the EXACT SAME string as one of the items in the "options" array. Copy-paste the option text exactly.
           - There MUST be EXACTLY ONE correct answer. The other ${multipleChoiceCount - 1} options MUST be clearly WRONG.
           - NEVER make all options correct. NEVER make no option correct.
           - Each option must be meaningfully different from the others.
        
        2. For "CSAT" (수능형):
           - The "passage" field is ABSOLUTELY REQUIRED. A CSAT question WITHOUT a passage is INVALID and will be rejected.
           - The passage MUST be at least 4-5 sentences, extracted or paraphrased from the source material.
           - The question asks about the passage content. Do NOT write "위 글을 읽고" if there is no passage.
           - If the question has options, the correctAnswer MUST be the EXACT same string as one option.
        
        3. For "TRUE_FALSE" (O/X):
           - The correctAnswer MUST be exactly "O" (true/맞음) or "X" (false/틀림). No other values.
           - Do NOT include an options array.
        
        4. For "SHORT_ANSWER" (단답형):
           - Answer is a specific word or short phrase (1~3 words).
        
        5. For "ESSAY" (서술형):
           - The correctAnswer should be a complete model answer (1~3 sentences).
        
        6. UNIVERSAL RULES:
           - "sourceContext" must quote the exact sentence from the source text supporting the answer.
           - "explanation" must explain WHY the answer is correct.
           - All content in Korean.
           - Each "id" must be unique (q1, q2, q3...).
           - The correctAnswer field must NEVER be empty.
        
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
      
      // ═══ Post-process: validate and fix common issues ═══
      parsed.questions = parsed.questions.map(q => {
        // Fix MULTIPLE_CHOICE / CSAT with options: ensure correctAnswer matches an option
        if ((q.type === 'MULTIPLE_CHOICE' || q.type === 'CSAT') && q.options && q.options.length > 0) {
          const exactMatch = q.options.find(opt => opt === q.correctAnswer);
          if (!exactMatch) {
            // Try normalized comparison
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
              // Final fallback: if still no match, set first option as answer
              if (!q.options.includes(q.correctAnswer)) {
                q.correctAnswer = q.options[0];
              }
            }
          }
        }
        
        // Fix CSAT: must have passage
        if (q.type === 'CSAT' && (!q.passage || q.passage.trim().length < 20)) {
          // Try to extract passage from the question itself
          const questionParts = q.question.split('\n').filter(p => p.trim().length > 0);
          if (questionParts.length > 2) {
            // Use first parts as passage, last part as question
            q.passage = questionParts.slice(0, -1).join('\n');
            q.question = questionParts[questionParts.length - 1];
          } else {
            // Convert to ESSAY if we can't fix it
            q.type = 'ESSAY';
            q.passage = undefined;
            if (q.options) {
              // If it had options and a correct answer in options, keep the answer
              q.options = undefined;
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
        
        // Ensure correctAnswer is never empty
        if (!q.correctAnswer || q.correctAnswer.trim() === '') {
          if (q.options && q.options.length > 0) {
            q.correctAnswer = q.options[0];
          } else if (q.type === 'TRUE_FALSE') {
            q.correctAnswer = 'O';
          } else {
            q.correctAnswer = '정답 정보 없음';
          }
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
