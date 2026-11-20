import AsyncStorage from '@react-native-async-storage/async-storage';

const GEMINI_API_KEY_STORAGE = 'bams_gemini_api_key_v1';
const GEMINI_MODEL_STORAGE = 'bams_gemini_model_v1';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash-lite';

export const SUPPORTED_GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended & Fast)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (Fast Fallback)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
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
   * Retrieve the preferred Gemini model, automatically migrating any legacy 1.5 models to gemini-2.5-flash
   */
  static async getModel(): Promise<string> {
    if (this.cachedModel) {
      if (this.cachedModel.includes('1.5') || this.cachedModel.includes('gemini-1.5')) {
        this.cachedModel = DEFAULT_GEMINI_MODEL;
      }
      return this.cachedModel;
    }
    try {
      const stored = await AsyncStorage.getItem(GEMINI_MODEL_STORAGE);
      if (stored && stored.trim()) {
        const trimmed = stored.trim();
        if (trimmed.includes('1.5') || trimmed.includes('gemini-1.5')) {
          this.cachedModel = DEFAULT_GEMINI_MODEL;
          await AsyncStorage.setItem(GEMINI_MODEL_STORAGE, DEFAULT_GEMINI_MODEL);
          return DEFAULT_GEMINI_MODEL;
        }
        this.cachedModel = trimmed;
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
    const cleanModel = model.includes('1.5') ? DEFAULT_GEMINI_MODEL : model;
    this.cachedModel = cleanModel;
    try {
      await AsyncStorage.setItem(GEMINI_MODEL_STORAGE, cleanModel);
    } catch (e) {
      console.warn('Could not persist Gemini Model:', e);
    }
  }

  /**
   * Test the connection to the Gemini API with a minimal ping and 15s timeout
   */
  static async testConnection(
    overrideKey?: string,
    overrideModel?: string
  ): Promise<{ success: boolean; message: string; modelUsed?: string }> {
    const apiKey = overrideKey?.trim() || (await this.getApiKey());
    if (!apiKey) {
      return { success: false, message: 'API Key missing. Please paste your Gemini API key.' };
    }

    let model = overrideModel || (await this.getModel());
    if (model.includes('1.5') || model.includes('gemini-1.5')) {
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
   * Helper to safely extract and parse JSON from Gemini's response,
   * stripping any markdown code fences (```json ... ```) or extra prose.
   */
  private static parseJsonSafely(rawText: string): any {
    if (!rawText || !rawText.trim()) {
      throw new Error('Received an empty response from Gemini AI.');
    }

    let cleaned = rawText.trim();
    // Strip leading ```json or ```
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    // Strip trailing ```
    cleaned = cleaned.replace(/\s*```$/i, '');
    cleaned = cleaned.trim();

    try {
      return JSON.parse(cleaned);
    } catch (initialErr: any) {
      // If direct parse failed, attempt to isolate the outermost JSON object { ... }
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
        } catch {
          // fall through to error
        }
      }
      throw new Error(`Failed to parse AI output as JSON: ${initialErr.message}`);
    }
  }

  /**
   * Full Interactive AI Assistant Transformation
   * Handles custom instructions, format conversions (Statement I & II, Assertion-Reason, Direct MCQ),
   * and bilingual Hindi polishing.
   * Features a 15-second network timeout and exhaustive error diagnostics.
   */
  static async transformQuestion(params: AIQuestionParams): Promise<AIQuestionResult> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error(
        'Gemini API Key missing. Please click "AI Settings" in the header to enter your API key.'
      );
    }

    let preferredModel = await this.getModel();
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

    const systemInstruction = `You are an expert BAMS / AIAPGET (All India AYUSH Post Graduate Entrance Test) Ayurveda examination author and editor.
Your task is to transform, convert, or polish the provided MCQ according to the user's specific instruction or requested format conversion.

CORE RULES:
1. Classical Ayurvedic Accuracy: Always maintain authentic Ayurvedic textual accuracy according to Brihat Trayi (Charaka Samhita, Sushruta Samhita, Ashtanga Hridaya/Sangraha) and Laghu Trayi.
2. Terminology & Spelling: Preserve and accurately spell classical Sanskrit/Ayurvedic terms with diacritics where applicable (e.g. Charaka, Audbhida, Sharira, Dosha, Dhatu, Mala, Ojas, Agni, Srotas, Guna, Virya, Vipaka, Prabhava).
3. STRICT BILINGUAL FORMATTING (English + Devanagari Hindi):
   - You MUST ALWAYS provide BOTH high-grade English AND natural, authentic Devanagari Hindi for all question stems, statements, options, and explanations.
   - NEVER drop or omit English. NEVER drop or omit Hindi. Both must be present in every single field.

4. MANDATORY BILINGUAL EXPLANATION:
   - "explanation" MUST NEVER BE IN ENGLISH ONLY. It is strictly mandatory to provide a comprehensive BILINGUAL explanation in both English and natural Hindi:
     1. English section: Thorough clinical and textual rationale, citing classical Samhita, Sthana, Adhyaya, and Shloka. If Statement question, clearly explain why Statement I is true or false, and why Statement II is true or false.
     2. Hindi section: Immediately followed by "\\n\\nहिंदी व्याख्या:\\n" with a complete, natural, grammatically correct Devanagari Hindi explanation of the exact same concepts, classical Shlokas, and justifications.

5. IF CONVERTING TO "Statement I & II":
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

6. IF CONVERTING TO "Assertion–Reason":
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

7. IF CONVERTING TO "Direct MCQ":
   - Set "questionType": "standard".
   - Formulate questionText as a direct, crisp exam question in both English and Devanagari Hindi.
   - Formulate 4 distinct options A, B, C, D in both English and Devanagari Hindi with 1 unambiguous correct answer.
   - Set "correctAnswer" index (0 for A, 1 for B, 2 for C, 3 for D).
   - In "explanation", provide complete bilingual explanation in English and Hindi.

8. IF FIXING "Bilingual Hindi":
   - Provide natural, authentic Devanagari Hindi translation alongside English in questionText and all options A–D without changing the correct answer index or clinical meaning.
   - Provide complete bilingual explanation in English and Hindi.

9. CUSTOM USER INSTRUCTIONS:
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
  "statement2": "..."
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

          // If model not found or deprecated, try next model in fallback list
          if (response.status === 404 || errMsg.toLowerCase().includes('not found')) {
            console.warn(`Model ${model} not found, falling back to next model...`);
            lastError = new Error(`Model ${model}: ${errMsg}`);
            continue;
          }

          // If invalid API key, quota exceeded, or permission error, throw immediately
          throw new Error(`Gemini API (${model}): ${errMsg}`);
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
          throw new Error('Gemini API returned an empty response candidate.');
        }

        const parsed = this.parseJsonSafely(rawText);

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

        let finalQuestionType = parsed.questionType || params.questionType;
        let finalQuestionText = String(parsed.questionText || '').trim();
        let s1 = parsed.statement1 ? String(parsed.statement1).trim() : undefined;
        let s2 = parsed.statement2 ? String(parsed.statement2).trim() : undefined;
        let aText = parsed.assertionText ? String(parsed.assertionText).trim() : undefined;
        let rText = parsed.reasonText ? String(parsed.reasonText).trim() : undefined;
        let finalExplanation = parsed.explanation ? String(parsed.explanation).trim() : params.explanation;

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
            const m1 = finalQuestionText.match(/Statement\s*I\s*[:\/]([\s\S]*?)(?=Statement\s*II|$)/i);
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
            // If questionText doesn't already contain both statements cleanly
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
            const ma = finalQuestionText.match(/Assertion\s*\(?A\)?\s*[:\/]([\s\S]*?)(?=Reason\s*\(?R\)?|$)/i);
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
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          lastError = new Error(
            `Gemini API request timed out after 15 seconds on model "${model}". Please check your internet connection or API quota.`
          );
        } else {
          lastError = err;
        }

        // If error is an invalid API key, do not keep trying other models since the key is rejected
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
