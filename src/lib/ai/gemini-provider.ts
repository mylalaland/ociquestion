import { GoogleGenerativeAI, SchemaType, ResponseSchema } from "@google/generative-ai";
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
          type: { type: SchemaType.STRING, enum: ["CSAT", "MULTIPLE_CHOICE", "SHORT_ANSWER"] } as any,
          question: { type: SchemaType.STRING },
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
      // Sanitize: remove any existing 'models/' prefix for the REST URL if we were using it in a different way,
      // but here we just need the key.
      const sanitizedKey = this.genAI.apiKey;
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${sanitizedKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "모델 목록을 가져오지 못했습니다.");
      }
      const data = await response.json();
      // Filter for models that support generateContent
      return data.models
        .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
        .map((m: any) => m.name.replace("models/", ""));
    } catch (error) {
      console.error("Discovery Failed:", error);
      throw error;
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        // Retry on 503 (Service Unavailable) or 429 (Too Many Requests)
        const isRetryable = error.message?.includes("503") || error.message?.includes("429") || error.status === 503 || error.status === 429;
        if (isRetryable && i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
          console.warn(`Retry attempt ${i + 1} after ${delay}ms due to: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async generateQuiz(text: string, types: string[], files?: File[], numQuestions: number = 5, difficulty: string = "보통"): Promise<QuizResult> {
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
        For "CSAT" (수능형), create a complex logical reasoning question typical of academic entrance exams.
        For "MULTIPLE_CHOICE" (객관식), create 5-option multiple choice questions.
        For "SHORT_ANSWER" (단답형/서술형), create questions where the answer is a specific phrase or sentence.
        
        For each question, accurately quote the 'sourceContext' (the exact sentence or paragraph from the text that provides the answer).
        All content should be in Korean as the target users are Korean students.

        Text provided (extracted from PDF or manually):
        ${text.slice(0, 30000)}
      `;

      const parts: any[] = [{ text: prompt }];

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
      return JSON.parse(response.text()) as QuizResult;
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
