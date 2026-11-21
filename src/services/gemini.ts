import AsyncStorage from '@react-native-async-storage/async-storage';

export type AIProvider = 'gemini' | 'groq';

export const DEFAULT_AI_PROVIDER: AIProvider = 'gemini';

export const SUPPORTED_AI_PROVIDERS: { id: AIProvider; label: string; desc: string }[] = [
  { id: 'gemini', label: 'Google Gemini', desc: 'gemini-2.5-flash / 3.8-flash' },
  { id: 'groq', label: 'Groq (Free & Fast)', desc: 'openai/gpt-oss-120b / qwen3.8-27b' },
];

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash-lite';

export const SUPPORTED_GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended & Fast)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (Fast Fallback)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
];

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
export const FALLBACK_GROQ_MODEL = 'qwen/qwen3.8-27b';

export const SUPPORTED_GROQ_MODELS = [
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Default for Exam-Grade MCQs)' },
  { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B (High-Precision Hindi / Devanagari)' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (Ultra-Fast Fallback)' },
];

/**
 * Normalizes legacy/unprefixed Groq model identifiers to their official prefixed forms
 */
export const normalizeGroqModel = (model: string): string => {
  const m = String(model || '').trim();
  if (m === 'gpt-oss-120b' || m === 'openai/gpt-oss-120b') {
    return 'openai/gpt-oss-120b';
  }
  if (
    m === 'qwen-3.8-27b' ||
    m === 'qwen/qwen-3.8-27b' ||
    m === 'qwen/qwen3.8-27b' ||
    m === 'qwen3.8-27b'
  ) {
    return 'qwen/qwen3.8-27b';
  }
  if (
    m === 'llama-3.3-70b-versatile' ||
    m === 'openai/gpt-oss-20b' ||
    m === 'gpt-oss-20b'
  ) {
    return 'openai/gpt-oss-20b';
  }
  return m || DEFAULT_GROQ_MODEL;
};

const STORAGE_KEYS = {
  PROVIDER: 'bams_ai_provider_v1',
  GEMINI_KEY: 'bams_gemini_api_key_v1',
  GEMINI_MODEL: 'bams_gemini_model_v1',
  GROQ_KEY: 'bams_groq_api_key_v1',
  GROQ_MODEL: 'bams_groq_model_v1',
};

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
  suggestedChapterTag?: string;
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
  private static cachedProvider: AIProvider | null = null;
  private static cachedGeminiKey: string | null = null;
  private static cachedGeminiModel: string | null = null;
  private static cachedGroqKey: string | null = null;
  private static cachedGroqModel: string | null = null;

  /**
   * Get the active AI provider ('gemini' | 'groq')
   */
  static async getProvider(): Promise<AIProvider> {
    if (this.cachedProvider) return this.cachedProvider;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PROVIDER);
      if (stored === 'groq' || stored === 'gemini') {
        this.cachedProvider = stored;
        return this.cachedProvider;
      }
    } catch (e) {
      console.warn('Could not read AI Provider from storage:', e);
    }
    return DEFAULT_AI_PROVIDER;
  }

  /**
   * Set the active AI provider ('gemini' | 'groq')
   */
  static async setProvider(provider: AIProvider): Promise<void> {
    this.cachedProvider = provider;
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PROVIDER, provider);
    } catch (e) {
      console.warn('Could not persist AI Provider:', e);
    }
  }

  /**
   * Retrieve the active provider's API key
   */
  static async getApiKey(): Promise<string> {
    const provider = await this.getProvider();
    if (provider === 'groq') {
      return this.getGroqApiKey();
    }
    return this.getGeminiApiKey();
  }

  /**
   * Save the API key for the active provider
   */
  static async setApiKey(key: string): Promise<void> {
    const provider = await this.getProvider();
    if (provider === 'groq') {
      await this.setGroqApiKey(key);
    } else {
      await this.setGeminiApiKey(key);
    }
  }

  /**
   * Retrieve the stored Gemini API key
   */
  static async getGeminiApiKey(): Promise<string> {
    if (this.cachedGeminiKey) return this.cachedGeminiKey;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.GEMINI_KEY);
      if (stored && stored.trim()) {
        this.cachedGeminiKey = stored.trim();
        return this.cachedGeminiKey;
      }
    } catch (e) {
      console.warn('Could not read Gemini API Key:', e);
    }
    return '';
  }

  /**
   * Save the Gemini API key
   */
  static async setGeminiApiKey(key: string): Promise<void> {
    const trimmed = (key || '').trim();
    this.cachedGeminiKey = trimmed;
    try {
      if (trimmed) {
        await AsyncStorage.setItem(STORAGE_KEYS.GEMINI_KEY, trimmed);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.GEMINI_KEY);
      }
    } catch (e) {
      console.warn('Could not persist Gemini API Key:', e);
    }
  }

  /**
   * Retrieve the preferred Gemini model
   */
  static async getGeminiModel(): Promise<string> {
    if (this.cachedGeminiModel) {
      if (this.cachedGeminiModel.includes('1.5')) {
        this.cachedGeminiModel = DEFAULT_GEMINI_MODEL;
      }
      return this.cachedGeminiModel;
    }
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.GEMINI_MODEL);
      if (stored && stored.trim()) {
        const trimmed = stored.trim();
        if (trimmed.includes('1.5')) {
          this.cachedGeminiModel = DEFAULT_GEMINI_MODEL;
          await AsyncStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, DEFAULT_GEMINI_MODEL);
          return DEFAULT_GEMINI_MODEL;
        }
        this.cachedGeminiModel = trimmed;
        return this.cachedGeminiModel;
      }
    } catch (e) {
      console.warn('Could not read Gemini Model preference:', e);
    }
    return DEFAULT_GEMINI_MODEL;
  }

  /**
   * Set the preferred Gemini model
   */
  static async setGeminiModel(model: string): Promise<void> {
    const cleanModel = model.includes('1.5') ? DEFAULT_GEMINI_MODEL : model;
    this.cachedGeminiModel = cleanModel;
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, cleanModel);
    } catch (e) {
      console.warn('Could not persist Gemini Model:', e);
    }
  }

  /**
   * Retrieve the stored Groq API key
   */
  static async getGroqApiKey(): Promise<string> {
    if (this.cachedGroqKey) return this.cachedGroqKey;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.GROQ_KEY);
      if (stored && stored.trim()) {
        this.cachedGroqKey = stored.trim();
        return this.cachedGroqKey;
      }
    } catch (e) {
      console.warn('Could not read Groq API Key:', e);
    }
    return '';
  }

  /**
   * Save the Groq API key
   */
  static async setGroqApiKey(key: string): Promise<void> {
    const trimmed = (key || '').trim();
    this.cachedGroqKey = trimmed;
    try {
      if (trimmed) {
        await AsyncStorage.setItem(STORAGE_KEYS.GROQ_KEY, trimmed);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.GROQ_KEY);
      }
    } catch (e) {
      console.warn('Could not persist Groq API Key:', e);
    }
  }

  /**
   * Retrieve the preferred Groq model with automatic legacy ID migration
   */
  static async getGroqModel(): Promise<string> {
    if (this.cachedGroqModel) {
      const normalized = normalizeGroqModel(this.cachedGroqModel);
      this.cachedGroqModel = normalized;
      return normalized;
    }
    try {
      // Check window.localStorage directly on web for instant migration
      if (typeof window !== 'undefined' && window.localStorage) {
        const direct = window.localStorage.getItem(STORAGE_KEYS.GROQ_MODEL);
        if (direct) {
          const norm = normalizeGroqModel(direct);
          if (norm !== direct) {
            window.localStorage.setItem(STORAGE_KEYS.GROQ_MODEL, norm);
          }
        }
      }

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.GROQ_MODEL);
      if (stored && stored.trim()) {
        const normalized = normalizeGroqModel(stored.trim());
        if (normalized !== stored.trim()) {
          await AsyncStorage.setItem(STORAGE_KEYS.GROQ_MODEL, normalized);
        }
        this.cachedGroqModel = normalized;
        return this.cachedGroqModel;
      }
    } catch (e) {
      console.warn('Could not read Groq Model preference:', e);
    }
    return DEFAULT_GROQ_MODEL;
  }

  /**
   * Set the preferred Groq model
   */
  static async setGroqModel(model: string): Promise<void> {
    const normalized = normalizeGroqModel(model);
    this.cachedGroqModel = normalized;
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.GROQ_MODEL, normalized);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEYS.GROQ_MODEL, normalized);
      }
    } catch (e) {
      console.warn('Could not persist Groq Model:', e);
    }
  }

  /**
   * Retrieve the active model based on active provider
   */
  static async getModel(): Promise<string> {
    const provider = await this.getProvider();
    if (provider === 'groq') {
      return this.getGroqModel();
    }
    return this.getGeminiModel();
  }

  /**
   * Set the active model based on active provider
   */
  static async setModel(model: string): Promise<void> {
    const provider = await this.getProvider();
    if (provider === 'groq') {
      await this.setGroqModel(model);
    } else {
      await this.setGeminiModel(model);
    }
  }

  /**
   * Test the connection to the specified (or active) AI provider with a minimal ping and 15s timeout
   */
  static async testConnection(
    overrideProvider?: AIProvider,
    overrideKey?: string,
    overrideModel?: string
  ): Promise<{ success: boolean; message: string; modelUsed?: string }> {
    const provider = overrideProvider || (await this.getProvider());

    if (provider === 'groq') {
      const apiKey = overrideKey?.trim() || (await this.getGroqApiKey());
      if (!apiKey) {
        return { success: false, message: 'Groq API Key missing. Please paste your Groq API key.' };
      }

      const rawModel = overrideModel || (await this.getGroqModel()) || DEFAULT_GROQ_MODEL;
      const model = normalizeGroqModel(rawModel);
      const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'user',
                content: 'Respond with exactly {"status":"connected"} as valid JSON.',
              },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          }),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg =
            errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
          return {
            success: false,
            message: `Groq API Error: ${errorMsg}`,
          };
        }

        return {
          success: true,
          message: `Successfully connected to Groq Free API using model "${model}"!`,
          modelUsed: model,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          return {
            success: false,
            message: 'Groq connection timed out after 15 seconds. Please check your network.',
          };
        }
        return {
          success: false,
          message: `Groq connection failed: ${err.message || 'Network error'}`,
        };
      }
    }

    // Google Gemini connection test
    const apiKey = overrideKey?.trim() || (await this.getGeminiApiKey());
    if (!apiKey) {
      return { success: false, message: 'Gemini API Key missing. Please paste your Gemini API key.' };
    }

    let model = overrideModel || (await this.getGeminiModel());
    if (model.includes('1.5')) {
      model = DEFAULT_GEMINI_MODEL;
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
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

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg =
          errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        return {
          success: false,
          message: `Gemini API Error: ${errorMsg}`,
        };
      }

      return {
        success: true,
        message: `Successfully connected to Gemini API using model "${model}"!`,
        modelUsed: model,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return {
          success: false,
          message: 'Connection timed out after 15 seconds. Please check your network.',
        };
      }
      return {
        success: false,
        message: `Connection failed: ${err.message || 'Network error'}`,
      };
    }
  }

  /**
   * Helper to safely extract and parse JSON from AI response,
   * stripping markdown code fences (```json ... ```) or extraneous prose.
   */
  private static parseJsonSafely(rawText: string): any {
    if (!rawText || !rawText.trim()) {
      throw new Error('Received an empty response from AI.');
    }

    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
    cleaned = cleaned.trim();

    try {
      return JSON.parse(cleaned);
    } catch (initialErr: any) {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
        } catch {
          // fall through
        }
      }
      throw new Error(`Failed to parse AI output as JSON: ${initialErr.message}`);
    }
  }

  /**
   * Post-processes parsed JSON from either Gemini or Groq to guarantee
   * full question preservation, correct statement labelling, and bilingual explanations.
   */
  private static processParsedResult(parsed: any, params: AIQuestionParams): AIQuestionResult {
    if (!parsed.questionText) {
      throw new Error('AI output missing required "questionText" key.');
    }

    let parsedCorrectAnswer = params.correctAnswer;
    if (
      typeof parsed.correctAnswer === 'number' &&
      parsed.correctAnswer >= 0 &&
      parsed.correctAnswer <= 3
    ) {
      parsedCorrectAnswer = parsed.correctAnswer;
    } else if (typeof parsed.correctAnswer === 'string') {
      const letter = parsed.correctAnswer.trim().toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(letter)) {
        parsedCorrectAnswer = letter.charCodeAt(0) - 65;
      }
    }

    const finalQuestionType = parsed.questionType || params.questionType;
    let finalQuestionText = String(parsed.questionText || '').trim();
    let s1 = parsed.statement1 ? String(parsed.statement1).trim() : undefined;
    let s2 = parsed.statement2 ? String(parsed.statement2).trim() : undefined;
    let aText = parsed.assertionText ? String(parsed.assertionText).trim() : undefined;
    let rText = parsed.reasonText ? String(parsed.reasonText).trim() : undefined;
    const finalExplanation = parsed.explanation
      ? String(parsed.explanation).trim()
      : params.explanation;

    // Post-processing for Statement I & II Questions:
    if (finalQuestionType === 'statement_type') {
      // 1. Clean mislabelled A: or R: prefixes from statements
      if (s1) {
        s1 = s1.replace(/^(?:A\s*[:\.]|Assertion\s*\(?A\)?\s*[:\.]?)\s*/i, 'Statement I: ');
        if (!s1.toLowerCase().startsWith('statement i')) {
          s1 = `Statement I: ${s1}`;
        }
      }
      if (s2) {
        s2 = s2.replace(/^(?:R\s*[:\.]|Reason\s*\(?R\)?\s*[:\.]?)\s*/i, 'Statement II: ');
        if (!s2.toLowerCase().startsWith('statement ii')) {
          s2 = `Statement II: ${s2}`;
        }
      }

      // 2. Clean mislabelled A: / R: from questionText
      finalQuestionText = finalQuestionText
        .replace(/(?:^|\n)\s*A:\s*/g, '\nStatement I: ')
        .replace(/(?:^|\n)\s*R:\s*/g, '\nStatement II: ');

      // 3. Extract s1 and s2 from questionText if they were not returned in their keys
      if (!s1) {
        const m1 = finalQuestionText.match(
          /Statement\s*I\s*[:\/]([\s\S]*?)(?=Statement\s*II|$)/i
        );
        if (m1) s1 = `Statement I: ${m1[1].trim()}`;
      }
      if (!s2) {
        const m2 = finalQuestionText.match(/Statement\s*II\s*[:\/]([\s\S]*?)$/i);
        if (m2) s2 = `Statement II: ${m2[1].trim()}`;
      }

      // 4. Ensure questionText contains the complete full bilingual question without cutting anything
      const stmtIntro =
        'Given below are two statements: One is labelled as Statement I and the other is labelled as Statement II. / नीचे दो कथन दिए गए हैं: एक को कथन I और दूसरे को कथन II कहा गया है।';

      if (s1 && s2) {
        if (
          !finalQuestionText.includes(s1.slice(0, 25)) ||
          !finalQuestionText.includes(s2.slice(0, 25))
        ) {
          finalQuestionText = `${stmtIntro}\n\n${s1}\n\n${s2}`;
        }
      }
    }

    // Post-processing for Assertion-Reason Questions:
    if (finalQuestionType === 'assertion_reason') {
      if (!aText) {
        const ma = finalQuestionText.match(
          /Assertion\s*\(?A\)?\s*[:\/]([\s\S]*?)(?=Reason\s*\(?R\)?|$)/i
        );
        if (ma) aText = `Assertion (A): ${ma[1].trim()}`;
      }
      if (!rText) {
        const mr = finalQuestionText.match(/Reason\s*\(?R\)?\s*[:\/]([\s\S]*?)$/i);
        if (mr) rText = `Reason (R): ${mr[1].trim()}`;
      }
    }

    return {
      questionType: finalQuestionType,
      questionText: finalQuestionText,
      optionA: String(parsed.optionA ?? params.optionA).trim(),
      optionB: String(parsed.optionB ?? params.optionB).trim(),
      optionC: String(parsed.optionC ?? params.optionC).trim(),
      optionD: String(parsed.optionD ?? params.optionD).trim(),
      correctAnswer: parsedCorrectAnswer,
      explanation: finalExplanation,
      assertionText: aText,
      reasonText: rText,
      statement1: s1,
      statement2: s2,
      suggestedChapterTag:
        typeof parsed.suggestedChapterTag === 'string' && parsed.suggestedChapterTag.trim()
          ? parsed.suggestedChapterTag.trim()
          : undefined,
    };
  }

  /**
   * Full Interactive AI Assistant Transformation
   * Dispatches to either Google Gemini or Groq Free API based on current AI settings.
   */
  static async transformQuestion(params: AIQuestionParams): Promise<AIQuestionResult> {
    const provider = await this.getProvider();

    const systemInstruction = `You are an expert BAMS / AIAPGET (All India AYUSH Post Graduate Entrance Test) Ayurveda examination author and editor.
Your task is to transform, convert, or polish the provided MCQ according to the user's specific instruction or requested format conversion.

CORE RULES:
1. Classical Ayurvedic Accuracy: Always maintain authentic Ayurvedic textual accuracy according to Brihat Trayi (Charaka Samhita, Sushruta Samhita, Ashtanga Hridaya/Sangraha) and Laghu Trayi.
2. CITATION / SANSKRIT SHLOKA IS THE SINGLE SOURCE OF TRUTH (CRITICAL):
   - Always treat the Sanskrit Shloka / Textual Citation (e.g., su.su 45/49, su.su 45/194, Sushruta sūtrasthānam 45/206, ca.ci 3/40, a.h. su 1/1) as the ABSOLUTE SINGLE SOURCE OF TRUTH.
   - Never invent or copy a Samhita name from the chapter tag or prompt if it contradicts the citation.
   - If the citation is from Sushruta Samhita (e.g. "su.su", "Sushruta", "सुश्रुत"), you MUST write "According to Sushruta Samhita / सुश्रुत संहिता के अनुसार" and auto-correct the chapter tag accordingly in "suggestedChapterTag" (e.g. "Sushruta Samhita > Sutrasthana > Chapter 45"). NEVER write "Charaka Samhita" for a "su.su" or "Sushruta" verse even if the chapter tag says Charaka! (Charaka Sutrasthana only has 30 chapters; Chapter 45 belongs to Sushruta Sutrasthana).
   - If the citation is from Charaka Samhita ("ca.su", "Charaka", "चरक"), refer to Charaka Samhita.
   - If the citation is from Ashtanga Hridaya ("a.h.", "Ashtanga", "वाग्भट"), refer to Ashtanga Hridaya / Acharya Vagbhata.
3. Terminology & Spelling: Preserve and accurately spell classical Sanskrit/Ayurvedic terms with diacritics where applicable (e.g. Charaka, Audbhida, Sharira, Dosha, Dhatu, Mala, Ojas, Agni, Srotas, Guna, Virya, Vipaka, Prabhava).
4. STRICT BILINGUAL FORMATTING (English + Devanagari Hindi):
   - You MUST ALWAYS provide BOTH high-grade English AND natural, authentic Devanagari Hindi for all question stems, statements, options, and explanations.
   - NEVER drop or omit English. NEVER drop or omit Hindi. Both must be present in every single field.

5. MANDATORY BILINGUAL EXPLANATION:
   - "explanation" MUST NEVER BE IN ENGLISH ONLY. It is strictly mandatory to provide a comprehensive BILINGUAL explanation in both English and natural Hindi:
     1. English section: Thorough clinical and textual rationale, citing classical Samhita, Sthana, Adhyaya, and Shloka. If Statement question, clearly explain why Statement I is true or false, and why Statement II is true or false.
     2. Hindi section: Immediately followed by "\\n\\nहिंदी व्याख्या:\\n" with a complete, natural, grammatically correct Devanagari Hindi explanation of the exact same concepts, classical Shlokas, and justifications.

6. IF CONVERTING TO "Statement I & II":
   - Set "questionType": "statement_type".
   - DO NOT CUT, TRUNCATE, OR DISCARD the original question's medical concept or context.
   - Formulate two complete, academically rigorous Ayurvedic medical statements derived directly from the classical reference:
     "statement1": "Statement I: [Complete English statement] / कथन I: [पूर्ण हिंदी कथन]"
     "statement2": "Statement II: [Complete English statement] / कथन II: [पूर्ण हिंदी कथन]"
   - NEVER label statements as "A:" or "R:"! Mislabelling statements as Assertion/Reason is strictly prohibited.
   - "questionText" MUST assemble the full question cleanly so that students see the complete question without anything cut off:
     "Given below are two statements: One is labelled as Statement I and the other is labelled as Statement II. / नीचे दो कथन दिए गए हैं: एक को कथन I और दूसरे को कथन II कहा गया है।\\n\\nStatement I: [Complete English statement]\\nकथन I: [पूर्ण हिंदी कथन]\\n\\nStatement II: [Complete English statement]\\nकथन II: [पूर्ण हिंदी कथन]"
   - Rewrite Options A–D to the official NTA AIAPGET standard:
     Option A: "Both Statement I and Statement II are correct / दोनों कथन I और II सही हैं"
     Option B: "Both Statement I and Statement II are incorrect / दोनों कथन I और II गलत हैं"
     Option C: "Statement I is correct but Statement II is incorrect / कथन I सही है परंतु कथन II गलत है"
     Option D: "Statement I is incorrect but Statement II is correct / कथन I गलत है परंतु कथन II सही है"
   - Compute and set "correctAnswer" index (0 for A, 1 for B, 2 for C, 3 for D) based on the medical correctness of Statement I & II.
   - In "explanation", provide a full bilingual explanation in English and Hindi detailing why Statement I is true/false AND why Statement II is true/false.

7. IF CONVERTING TO "Assertion–Reason":
   - Set "questionType": "assertion_reason".
   - DO NOT CUT the clinical concept.
   - Formulate "assertionText" and "reasonText", both bilingual:
     "assertionText": "Assertion (A): [Complete English] / अभिकथन (A): [पूर्ण हिंदी]"
     "reasonText": "Reason (R): [Complete English] / कारण (R): [पूर्ण हिंदी]"
   - "questionText" MUST assemble:
     "Given below are two statements: One is labelled as Assertion (A) and the other is labelled as Reason (R). / नीचे दो कथन दिए गए हैं: एक को अभिकथन (A) और दूसरे को कारण (R) कहा गया है।\\n\\nAssertion (A): [English]\\nअभिकथन (A): [हिंदी]\\n\\nReason (R): [English]\\nकारण (R): [हिंदी]"
   - Rewrite Options A–D to the official NTA AIAPGET standard:
     Option A: "Both (A) and (R) are true and (R) is the correct explanation of (A) / (A) और (R) दोनों सही हैं और (R), (A) की सही व्याख्या है"
     Option B: "Both (A) and (R) are true but (R) is NOT the correct explanation of (A) / (A) और (R) दोनों सही हैं परंतु (R), (A) की सही व्याख्या नहीं है"
     Option C: "(A) is true but (R) is false / (A) सही है परंतु (R) सही नहीं है"
     Option D: "(A) is false but (R) is true / (A) सही नहीं है परंतु (R) सही है"
   - Set "correctAnswer" index (0 for A, 1 for B, 2 for C, 3 for D).
   - In "explanation", provide complete bilingual explanation in English and Hindi.

8. IF CONVERTING TO "Direct MCQ":
   - Set "questionType": "standard".
   - Formulate questionText as a direct, crisp exam question in both English and Devanagari Hindi.
   - Formulate 4 distinct options A, B, C, D in both English and Devanagari Hindi with 1 unambiguous correct answer.
   - Set "correctAnswer" index (0 for A, 1 for B, 2 for C, 3 for D).
   - In "explanation", provide complete bilingual explanation in English and Hindi.

9. IF FIXING "Bilingual Hindi":
   - Provide natural, authentic Devanagari Hindi translation alongside English in questionText and all options A–D without changing the correct answer index or clinical meaning.
   - Provide complete bilingual explanation in English and Hindi.

10. CUSTOM USER INSTRUCTIONS:
   - Faithfully follow the instruction, updating all affected fields while ALWAYS maintaining bilingual English + Devanagari Hindi in stems, statements, options, and explanations.

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
  "statement2": "...",
  "suggestedChapterTag": "Sushruta Samhita > Sutrasthana > Chapter 45"
}`;

    const userPayload = {
      userInstruction:
        params.customInstruction?.trim() ||
        'Polish and rephrase this MCQ into clear, exam-grade English and natural Hindi.',
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

    // -------------------------------------------------------------
    // BRANCH A: GROQ (FREE & FAST)
    // -------------------------------------------------------------
    if (provider === 'groq') {
      const groqKey = await this.getGroqApiKey();
      if (!groqKey) {
        throw new Error(
          'Groq API Key missing. Please click "AI Settings" in the header to enter your free Groq API key (or switch to Google Gemini).'
        );
      }

      const preferredGroqModel = await this.getGroqModel();
      const isHindiTask =
        (params.customInstruction || '').toLowerCase().includes('hindi') ||
        (params.customInstruction || '').toLowerCase().includes('devanagari');

      // Candidate models with smart prioritization:
      const candidateGroqModels = (
        isHindiTask
          ? ['qwen/qwen3.8-27b', preferredGroqModel, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']
          : [preferredGroqModel, 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b']
      ).map(normalizeGroqModel);

      const uniqueGroqModels = Array.from(new Set(candidateGroqModels));
      let lastGroqError: any = null;

      for (const model of uniqueGroqModels) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
          const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${groqKey}`,
            },
            signal: controller.signal,
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: 'system',
                  content: systemInstruction,
                },
                {
                  role: 'user',
                  content: `Transform this Ayurveda MCQ according to the instruction:\n\n${JSON.stringify(
                    userPayload,
                    null,
                    2
                  )}`,
                },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.2,
            }),
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            const errMsg =
              errBody?.error?.message || `HTTP ${response.status} ${response.statusText}`;

            // If rate-limited (429) or model not found (404), fallback to next model
            if (
              response.status === 429 ||
              response.status === 404 ||
              errMsg.toLowerCase().includes('rate limit') ||
              errMsg.toLowerCase().includes('not found')
            ) {
              console.warn(`Groq model ${model} issue (${errMsg}), falling back to next model...`);
              lastGroqError = new Error(`Groq (${model}): ${errMsg}`);
              continue;
            }

            throw new Error(`Groq API (${model}): ${errMsg}`);
          }

          const data = await response.json();
          const rawText = data?.choices?.[0]?.message?.content;

          if (!rawText) {
            throw new Error('Groq API returned an empty message content.');
          }

          const parsed = this.parseJsonSafely(rawText);
          return this.processParsedResult(parsed, params);
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            lastGroqError = new Error(
              `Groq request timed out after 15 seconds on model "${model}". Please check your internet connection or switch to Gemini.`
            );
          } else {
            lastGroqError = err;
          }

          if (
            lastGroqError.message?.toLowerCase().includes('invalid api key') ||
            lastGroqError.message?.toLowerCase().includes('invalid_api_key')
          ) {
            throw lastGroqError;
          }

          console.warn(`Attempt with Groq ${model} failed:`, lastGroqError.message);
        }
      }

      throw (
        lastGroqError ||
        new Error(
          'Failed to process question with Groq API. You can switch to Google Gemini in AI Settings.'
        )
      );
    }

    // -------------------------------------------------------------
    // BRANCH B: GOOGLE GEMINI (DEFAULT)
    // -------------------------------------------------------------
    const apiKey = await this.getGeminiApiKey();
    if (!apiKey) {
      throw new Error(
        'Gemini API Key missing. Please click "AI Settings" in the header to enter your API key (or switch to Groq Free).'
      );
    }

    let preferredModel = await this.getGeminiModel();
    if (preferredModel.includes('1.5') || preferredModel.includes('gemini-1.5')) {
      preferredModel = DEFAULT_GEMINI_MODEL;
    }

    const candidateModels = [
      preferredModel,
      DEFAULT_GEMINI_MODEL,
      FALLBACK_GEMINI_MODEL,
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
    ].filter((m) => !m.includes('1.5'));

    const uniqueModels = Array.from(new Set(candidateModels));
    let lastError: any = null;

    for (const model of uniqueModels) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: [
              {
                parts: [
                  {
                    text: `Transform this Ayurveda MCQ according to the instruction:\n\n${JSON.stringify(
                      userPayload,
                      null,
                      2
                    )}`,
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

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          const errMsg = errBody?.error?.message || `HTTP ${response.status} ${response.statusText}`;

          if (response.status === 404 || errMsg.toLowerCase().includes('not found')) {
            console.warn(`Model ${model} not found, falling back to next model...`);
            lastError = new Error(`Model ${model}: ${errMsg}`);
            continue;
          }

          throw new Error(`Gemini API (${model}): ${errMsg}`);
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
          throw new Error('Gemini API returned an empty response candidate.');
        }

        const parsed = this.parseJsonSafely(rawText);
        return this.processParsedResult(parsed, params);
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          lastError = new Error(
            `Gemini API request timed out after 15 seconds on model "${model}". Please check your internet connection or switch to Groq.`
          );
        } else {
          lastError = err;
        }

        if (
          lastError.message?.toLowerCase().includes('api key not valid') ||
          lastError.message?.toLowerCase().includes('api_key_invalid') ||
          lastError.message?.toLowerCase().includes('permission')
        ) {
          throw lastError;
        }

        console.warn(`Attempt with ${model} failed:`, lastError.message);
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
