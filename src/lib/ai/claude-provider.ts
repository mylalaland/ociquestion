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

  async generateQuiz(text: string, types: string[], numQuestions: number = 5, difficulty: string = "보통"): Promise<QuizResult> {
    const systemPrompt = `You are a professional educational quiz generator. Output ONLY clean JSON matching this JSON schema:
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
    `;

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

      Remember, output only raw JSON without markdown markers or backticks.

      Text provided:
      ${text.slice(0, 15000)}
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
          messages: [
            { role: "user", content: prompt }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Claude 퀴즈 생성 오류");
      }

      const data = await response.json();
      const content = data.content[0]?.text || "";
      // Strip markdown code block wrappers if Claude outputs them
      const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned) as QuizResult;
    } catch (error: unknown) {
      console.error("Claude Generate Quiz Failed:", error);
      throw error;
    }
  }
}
