import { QuizQuestion, QuizResult } from "./types";

export class ClaudeProvider {
  private apiKey: string;
  private modelId: string;

  constructor(apiKey: string, modelId: string = "claude-3-5-sonnet-latest") {
    this.apiKey = apiKey.trim();
    this.modelId = modelId.trim();
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true" // Required for browser calls
        },
        body: JSON.stringify({
          model: this.modelId,
          max_tokens: 5,
          messages: [{ role: "user", content: "Hi" }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Claude 연결 테스트 실패");
      }
      return true;
    } catch (error) {
      console.error("Claude Connection Test Failed:", error);
      throw error;
    }
  }

  async generateQuiz(text: string, types: string[], numQuestions: number = 5, difficulty: string = "보통", multipleChoiceCount: number = 5): Promise<QuizResult> {
    const systemPrompt = `You are a professional educational quiz generator. Output ONLY clean JSON matching this schema:
    { "title": "string", "summary": "string", "questions": [{ "id": "string", "type": "CSAT|MULTIPLE_CHOICE|SHORT_ANSWER|ESSAY|TRUE_FALSE", "question": "string", "passage": "string (CSAT only)", "options": ["string"], "correctAnswer": "string", "explanation": "string", "sourceContext": "string" }] }`;

    const prompt = `
      Generate a quiz with EXACTLY ${numQuestions} questions. Difficulty: [${difficulty}].
      Types: ${types.join(", ")}.
      
      CRITICAL RULES:
      1. MULTIPLE_CHOICE: ${multipleChoiceCount} options. correctAnswer MUST exactly match one option string. Exactly ONE correct answer.
      2. CSAT: MUST include "passage" field (3+ sentences). correctAnswer must match one option.
      3. TRUE_FALSE (O/X): correctAnswer must be "O" or "X". No options array.
      4. SHORT_ANSWER: 1-3 word answer. 5. ESSAY: 1-3 sentence model answer.
      All in Korean. sourceContext must quote exact source text. Raw JSON only.
      
      Text: ${text.slice(0, 15000)}
    `;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: this.modelId,
          system: systemPrompt,
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Claude 퀴즈 생성 오류");
      }

      const data = await response.json();
      const content = data.content[0]?.text || "";
      const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned) as QuizResult;
      
      // Post-process
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
      console.error("Claude Generate Quiz Failed:", error);
      throw error;
    }
  }
}

