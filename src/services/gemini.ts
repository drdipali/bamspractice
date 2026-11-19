import AsyncStorage from '@react-native-async-storage/async-storage';

const GEMINI_API_KEY_STORAGE = 'bams_gemini_api_key_v1';
const GEMINI_MODEL_STORAGE = 'bams_gemini_model_v1';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export const SUPPORTED_GEMINI_MODELS = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (Fastest & Recommended)' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (High Accuracy)' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Balanced)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fallback)' },
];

export interface AIQuestionParams {
  questionType: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: number; // 0, 1, 2, 3
  explanation?: string;
  reference?: string;
  chapter?: string;
  assertionText?: string;
  reasonText?: string;
  statement1?: string;
  statement2?: string;
  customInstruction?: string;
}

export interface AIQuestionResult {
  questionType?: 'standard' | 'assertion_reason' | 'match_the_pair' | 'statement_type';
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer?: number; // 0, 1, 2, 3
  explanation?: string;
  assertionText?: string;
  reasonText?: string;
  statement1?: string;
  statement2?: string;
}

export interface RephraseParams {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  reference?: string;
  questionType?: string;
  chapter?: string;
  customInstruction?: string;
}

export interface RephraseResult {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

export class GeminiService {
  private static cachedKey: string | null = null;
  private static cachedModel: string | null = null;

  /**
   * Retrieve the stored Gemini API key from AsyncStorage / localStorage
   */
  static async getApiKey(): Promise<string> {
    if (this.cachedKey) return this.cachedKey;
    try {
      const stored = await AsyncStorage.getItem(GEMINI_API_KEY_STORAGE);
      if (stored && stored.trim()) {
        this.cachedKey = stored.trim();
        return this.cachedKey;
      }
    } catch (e) {
      console.warn('Could not read Gemini API Key from storage:', e);
    }
    return '';
  }

  /**
   * Save the Gemini API key securely in AsyncStorage / localStorage
   */
  static async setApiKey(key: string): Promise<void> {
    const trimmed = (key || '').trim();
    this.cachedKey = trimmed;
    try {
      if (trimmed) {
        await AsyncStorage.setItem(GEMINI_API_KEY_STORAGE, trimmed);
      } else {
        await AsyncStorage.removeItem(GEMINI_API_KEY_STORAGE);
      }
    } catch (e) {
      console.warn('Could not persist Gemini API Key:', e);
    }
  }

  /**
   * Retrieve the preferred Gemini model
   */
  static async getModel(): Promise<string> {
    if (this.cachedModel) return this.cachedModel;
    try {
      const stored = await AsyncStorage.getItem(GEMINI_MODEL_STORAGE);
      if (stored && stored.trim()) {
        this.cachedModel = stored.trim();
        return this.cachedModel;
      }
    } catch (e) {
      console.warn('Could not read Gemini Model preference:', e);
    }
    return DEFAULT_GEMINI_MODEL;
  }

  /**
   * Set the preferred Gemini model
   */
  static async setModel(model: string): Promise<void> {
    this.cachedModel = model;
    try {
      await AsyncStorage.setItem(GEMINI_MODEL_STORAGE, model);
    } catch (e) {
      console.warn('Could not persist Gemini Model:', e);
    }
  }

  /**
   * Test the connection to the Gemini API with a minimal ping
   */
  static async testConnection(
    overrideKey?: string,
    overrideModel?: string
  ): Promise<{ success: boolean; message: string; modelUsed?: string }> {
    const apiKey = overrideKey?.trim() || (await this.getApiKey());
    if (!apiKey) {
      return { success: false, message: 'Please enter a Gemini API Key first.' };
    }

    const model = overrideModel || (await this.getModel());
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'Respond with exactly {"status":"connected"} as valid JSON.' }],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg =
          errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        return {
          success: false,
          message: `API Error: ${errorMsg}`,
        };
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        return {
          success: false,
          message: 'Received empty response from Gemini API.',
        };
      }

      return {
        success: true,
        message: `Successfully connected to Gemini API using model "${model}"!`,
        modelUsed: model,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Connection failed: ${err.message || 'Network error'}`,
      };
    }
  }

  /**
   * Full Interactive AI Assistant Transformation
   * Handles custom instructions, format conversions (Statement I & II, Assertion-Reason, Direct MCQ),
   * and bilingual Hindi polishing.
   */
  static async transformQuestion(params: AIQuestionParams): Promise<AIQuestionResult> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error(
        'Gemini API Key is not set. Please click "AI Settings" in the header to enter your API key.'
      );
    }

    const preferredModel = await this.getModel();
    const candidateModels = [
      preferredModel,
      DEFAULT_GEMINI_MODEL,
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
    ];

    const uniqueModels = Array.from(new Set(candidateModels));

    const systemInstruction = `You are an expert BAMS / AIAPGET (All India AYUSH Post Graduate Entrance Test) Ayurveda examination author and editor.
Your task is to transform, convert, or polish the provided MCQ according to the user's specific instruction or requested format conversion.

RULES:
1. Always maintain classical Ayurvedic medical accuracy according to Brihat Trayi (Charaka Samhita, Sushruta Samhita, Ashtanga Hridaya/Sangraha) and Laghu Trayi.
2. Fix spelling of Sanskrit and Ayurvedic concepts (e.g. Charaka, Audbhida, Sharira, Dosha, Dhatu, Mala, Ojas, Agni, Srotas, Guna, Virya, Vipaka, Prabhava).
3. Ensure high quality bilingual formatting (English + Devanagari Hindi) where applicable.
4. If converting to "Statement I & II":
   - Set questionType to "statement_type".
   - Formulate two clear, high-yield Ayurvedic medical statements: "statement1" and "statement2" (both in English and Devanagari/Hindi).
   - The questionText should introduce the two statements: "Given below are two statements: One is labelled as Statement I and the other is labelled as Statement II. / नीचे दो कथन दिए गए हैं: एक को कथन I और दूसरे को कथन II के रूप में लेबल किया गया है।"
   - Rewrite Options A–D to the official NTA AIAPGET standard:
     Option A: "Both Statement I and Statement II are correct / दोनों कथन I और II सही हैं"
     Option B: "Both Statement I and Statement II are incorrect / दोनों कथन I और II गलत हैं"
     Option C: "Statement I is correct but Statement II is incorrect / कथन I सही है परंतु कथन II गलत है"
     Option D: "Statement I is incorrect but Statement II is correct / कथन I गलत है परंतु कथन II सही है"
   - Compute and set "correctAnswer" (0 for A, 1 for B, 2 for C, 3 for D) based on the medical correctness of Statement I & II.
5. If converting to "Assertion–Reason":
   - Set questionType to "assertion_reason".
   - Formulate "assertionText" (Assertion A) and "reasonText" (Reason R) (both in English and Devanagari/Hindi).
   - The questionText should be: "Given below are two statements: one is labelled as Assertion (A) and the other is labelled as Reason (R). / नीचे दो कथन दिए गए हैं: एक को अभिकथन (A) और दूसरे को कारण (R) कहा गया है।"
   - Rewrite Options A–D to the official NTA AIAPGET standard:
     Option A: "Both (A) and (R) are true and (R) is the correct explanation of (A) / (A) और (R) दोनों सही हैं और (R), (A) की सही व्याख्या है"
     Option B: "Both (A) and (R) are true but (R) is NOT the correct explanation of (A) / (A) और (R) दोनों सही हैं परंतु (R), (A) की सही व्याख्या नहीं है"
     Option C: "(A) is true but (R) is false / (A) सही है परंतु (R) सही नहीं है"
     Option D: "(A) is false but (R) is true / (A) सही नहीं है परंतु (R) सही है"
   - Compute and set "correctAnswer" (0 for A, 1 for B, 2 for C, 3 for D).
6. If converting to "Direct MCQ":
   - Set questionType to "standard".
   - Make questionText a direct, crisp exam question.
   - Formulate 4 distinct options A, B, C, D with exactly 1 unambiguous correct answer.
   - Set "correctAnswer" index (0 for A, 1 for B, 2 for C, 3 for D).
7. If fixing "Bilingual Hindi":
   - Provide natural, authentic Devanagari Hindi translation alongside English in both questionText and all options A–D without changing the correct answer index or clinical meaning.
8. If given a custom user instruction:
   - Faithfully follow the instruction, updating all affected fields.

OUTPUT FORMAT:
Return ONLY a valid JSON object with the following keys:
{
  "questionType": "standard" | "assertion_reason" | "statement_type" | "match_the_pair",
  "questionText": "...",
  "optionA": "...",
  "optionB": "...",
  "optionC": "...",
  "optionD": "...",
  "correctAnswer": 0 | 1 | 2 | 3,
  "explanation": "...",
  "assertionText": "...",
  "reasonText": "...",
  "statement1": "...",
  "statement2": "..."
}`;

    const userPayload = {
      userInstruction: params.customInstruction?.trim() || 'Polish and rephrase this MCQ into clear, exam-grade English and natural Hindi.',
      currentQuestionType: params.questionType,
      chapter: params.chapter || '',
      referenceShloka: params.reference || '',
      currentQuestionText: params.questionText,
      currentOptions: {
        A: params.optionA,
        B: params.optionB,
        C: params.optionC,
        D: params.optionD,
      },
      currentCorrectAnswerIndex: params.correctAnswer,
      currentCorrectLetter: ['A', 'B', 'C', 'D'][params.correctAnswer] || 'A',
      currentExplanation: params.explanation || '',
      currentAssertionText: params.assertionText || '',
      currentReasonText: params.reasonText || '',
      currentStatement1: params.statement1 || '',
      currentStatement2: params.statement2 || '',
    };

    let lastError: any = null;

    for (const model of uniqueModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: [
              {
                parts: [
                  {
                    text: `Transform this Ayurveda MCQ according to the instruction:\n\n${JSON.stringify(userPayload, null, 2)}`,
                  },
                ],
              },
            ],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.2,
            },
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          const errMsg = errBody?.error?.message || `HTTP ${response.status}`;
          if (response.status === 404 || errMsg.toLowerCase().includes('not found')) {
            console.warn(`Model ${model} not available, falling back to next model...`);
            lastError = new Error(`Model ${model}: ${errMsg}`);
            continue;
          }
          throw new Error(`Gemini API error (${model}): ${errMsg}`);
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
          throw new Error('Gemini API returned an empty candidate.');
        }

        const cleaned = rawText
          .trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        const parsed = JSON.parse(cleaned);

        if (!parsed.questionText) {
          throw new Error('AI output missing "questionText" key.');
        }

        let parsedCorrectAnswer = params.correctAnswer;
        if (typeof parsed.correctAnswer === 'number' && parsed.correctAnswer >= 0 && parsed.correctAnswer <= 3) {
          parsedCorrectAnswer = parsed.correctAnswer;
        } else if (typeof parsed.correctAnswer === 'string') {
          const letter = parsed.correctAnswer.trim().toUpperCase();
          if (['A', 'B', 'C', 'D'].includes(letter)) {
            parsedCorrectAnswer = letter.charCodeAt(0) - 65;
          }
        }

        return {
          questionType: parsed.questionType || params.questionType,
          questionText: String(parsed.questionText).trim(),
          optionA: String(parsed.optionA ?? params.optionA).trim(),
          optionB: String(parsed.optionB ?? params.optionB).trim(),
          optionC: String(parsed.optionC ?? params.optionC).trim(),
          optionD: String(parsed.optionD ?? params.optionD).trim(),
          correctAnswer: parsedCorrectAnswer,
          explanation: parsed.explanation ? String(parsed.explanation).trim() : params.explanation,
          assertionText: parsed.assertionText ? String(parsed.assertionText).trim() : undefined,
          reasonText: parsed.reasonText ? String(parsed.reasonText).trim() : undefined,
          statement1: parsed.statement1 ? String(parsed.statement1).trim() : undefined,
          statement2: parsed.statement2 ? String(parsed.statement2).trim() : undefined,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`Attempt with ${model} failed:`, err.message);
      }
    }

    throw lastError || new Error('Failed to process question with Gemini API.');
  }

  /**
   * Backward-compatible simple rephrase method
   */
  static async rephraseQuestion(params: RephraseParams): Promise<RephraseResult> {
    const res = await this.transformQuestion({
      questionType: params.questionType || 'standard',
      questionText: params.questionText,
      optionA: params.optionA,
      optionB: params.optionB,
      optionC: params.optionC,
      optionD: params.optionD,
      correctAnswer: 0,
      reference: params.reference,
      chapter: params.chapter,
      customInstruction: params.customInstruction,
    });

    return {
      questionText: res.questionText,
      optionA: res.optionA,
      optionB: res.optionB,
      optionC: res.optionC,
      optionD: res.optionD,
    };
  }
}
