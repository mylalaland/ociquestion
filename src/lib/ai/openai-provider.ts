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

  async generateQuiz(text: string, types: string[], numQuestions: number = 5, difficulty: string = "보통", multipleChoiceCount: number = 5): Promise<QuizResult> {
    const prompt = `
      Analyze the provided content and generate a quiz with EXACTLY ${numQuestions} questions.
      The overall difficulty of the questions should be: [${difficulty}].
      The quiz should include the following types as evenly distributed as possible: ${types.join(", ")}.
      
      ===== CRITICAL RULES (MUST FOLLOW) =====
      
      1. For "MULTIPLE_CHOICE" (객관식):
         - Create ${multipleChoiceCount}-option multiple choice questions.
         - The "correctAnswer" field MUST be the EXACT same string as one of the items in the "options" array.
         - There MUST be exactly ONE correct answer. Never create questions where all options are correct or no option is correct.
      
      2. For "CSAT" (수능형):
         - You MUST include a "passage" field with a substantial reading passage (at least 3-4 sentences).
         - NEVER create a CSAT question without a passage.
         - If the question has options, the correctAnswer MUST exactly match one of the option strings.
      
      3. For "TRUE_FALSE" (O/X):
         - Create statements that are either true or false.
         - The correctAnswer MUST be exactly "O" (true) or "X" (false). Do NOT include options.
      
      4. For "SHORT_ANSWER" (단답형): answer is 1~3 words max.
      5. For "ESSAY" (서술형): longer explanatory answer (1~3 sentences).
      
      For EVERY question: sourceContext must quote the exact text, explanation must explain WHY. All in Korean.
      ===== END RULES =====

      Return JSON: { "title": "string", "summary": "string", "questions": [{ "id": "string", "type": "CSAT|MULTIPLE_CHOICE|SHORT_ANSWER|ESSAY|TRUE_FALSE", "question": "string", "passage": "string (CSAT only)", "options": ["string"], "correctAnswer": "string", "explanation": "string", "sourceContext": "string" }] }

      Text:
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
      const parsed = JSON.parse(content) as QuizResult;
      
      // Post-process validation
      parsed.questions = parsed.questions.map(q => {
        if ((q.type === 'MULTIPLE_CHOICE' || q.type === 'CSAT') && q.options && q.options.length > 0) {
          if (!q.options.includes(q.correctAnswer)) {
            const numMatch = q.correctAnswer.match(/(\d+)/);
            if (numMatch) {
              const idx = parseInt(numMatch[1], 10) - 1;
              if (idx >= 0 && idx < q.options.length) q.correctAnswer = q.options[idx];
            }
          }
        }
        if (q.type === 'TRUE_FALSE') {
          const ans = q.correctAnswer.trim().toUpperCase();
          q.correctAnswer = (ans.includes('O') || ans.includes('TRUE') || ans.includes('맞')) ? 'O' : 'X';
          q.options = undefined;
        }
        return q;
      });
      
      return parsed;
    } catch (error: unknown) {
      console.error("OpenAI Generate Quiz Failed:", error);
      throw error;
    }
  }
}

