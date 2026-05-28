import { QuizQuestion, QuizResult } from "./types";

export class OpenAIProvider {
  private apiKey: string;
  private modelId: string;

  constructor(apiKey: string, modelId: string = "gpt-4o-mini") {
    this.apiKey = apiKey.trim();
    this.modelId = modelId.trim();
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "OpenAI 연결 테스트 실패");
      }
      return true;
    } catch (error) {
      console.error("OpenAI Connection Test Failed:", error);
      throw error;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "OpenAI 모델 목록 로드 실패");
      }

      const data = await response.json();
      return data.data
        .filter((m: { id: string }) => m.id.startsWith("gpt-") || m.id.includes("o1") || m.id.includes("o3"))
        .map((m: { id: string }) => m.id)
        .sort();
    } catch (error) {
      console.error("OpenAI Model Discovery Failed:", error);
      throw error;
    }
  }

  async generateQuiz(text: string, types: string[], numQuestions: number = 5, difficulty: string = "보통"): Promise<QuizResult> {
    const prompt = `
      Analyze the provided content and generate a quiz with EXACTLY ${numQuestions} questions.
      The overall difficulty of the questions should be: [${difficulty}].
      The quiz should include the following types as evenly distributed as possible: ${types.join(", ")}.
      
      For "CSAT" (수능형), create a complex logical reasoning question typical of academic entrance exams. For CSAT questions, if they have options, the correctAnswer MUST exactly match one of the string items in the options array.
      For "MULTIPLE_CHOICE" (객관식), create 5-option multiple choice questions. The correctAnswer MUST exactly match one of the string items in the options array (not the number or a prefix, but the exact string itself).
      For "SHORT_ANSWER" (단답형), create questions where the answer is a specific word or short phrase (1~3 words max).
      For "ESSAY" (서술형), create questions that require a longer, explanatory answer (1~3 sentences). The correctAnswer should be a model answer.
      
      For each question, accurately quote the 'sourceContext' (the exact sentence or paragraph from the text that provides the answer).
      All content should be in Korean as the target users are Korean students.

      You must return your output strictly in JSON format matching this JSON schema:
      {
        "title": "string (Title of the quiz)",
        "summary": "string (Short summary of the document)",
        "questions": [
          {
            "id": "string (unique string id, e.g. 'q1', 'q2')",
            "type": "string (CSAT | MULTIPLE_CHOICE | SHORT_ANSWER | ESSAY)",
            "question": "string",
            "options": ["string"] (array of strings, strictly required for CSAT/MULTIPLE_CHOICE, otherwise omitted or empty),
            "correctAnswer": "string",
            "explanation": "string",
            "sourceContext": "string"
          }
        ]
      }

      Text provided:
      ${text.slice(0, 15000)}
    `;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelId,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are a professional educational quiz generator. Output ONLY clean JSON matching the requested schema." },
            { role: "user", content: prompt }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "OpenAI 퀴즈 생성 오류");
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      return JSON.parse(content) as QuizResult;
    } catch (error: unknown) {
      console.error("OpenAI Generate Quiz Failed:", error);
      throw error;
    }
  }
}
