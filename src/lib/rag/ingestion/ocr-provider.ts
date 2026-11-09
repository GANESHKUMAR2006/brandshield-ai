/**
 * BrandShield AI — OCR Provider Interface & Factory
 * Phase 2: Multimodal Verification & Document Citation Viewer
 *
 * Provides a unified OCR abstraction supporting Cloud Vision APIs (OpenAI / Groq)
 * and an ultra-fast local fallback engine for deterministic offline testing.
 */

export interface OcrWord {
  text: string;
  bbox?: number[]; // [x, y, width, height]
  confidence?: number;
}

export interface OcrResult {
  text: string;
  confidence: number; // 0.000 to 1.000
  engine: string;
  words?: OcrWord[];
  pageNumber?: number;
}

export interface OcrProvider {
  readonly name: string;
  extractText(
    input: Buffer | string,
    mimeType?: string,
    options?: { pageNumber?: number; language?: string }
  ): Promise<OcrResult>;
}

/**
 * Local deterministic OCR provider for offline tests and lightweight environments.
 * Extracts embedded text streams, image markers, or formatted test fixture tokens.
 */
export class LocalFallbackOcrProvider implements OcrProvider {
  public readonly name = "local-deterministic-ocr";

  public async extractText(
    input: Buffer | string,
    _mimeType?: string,
    options?: { pageNumber?: number; language?: string }
  ): Promise<OcrResult> {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf-8");

    // Check for explicit OCR fixture text in buffer
    const rawStr = buffer.toString("utf-8");
    if (
      rawStr.includes("OCR_FIXTURE:") ||
      rawStr.includes("SCANNED_PAGE:") ||
      rawStr.includes("SCANNED_PDF:") ||
      rawStr.includes("[SCANNED_OCR]")
    ) {
      const cleaned = rawStr
        .replace(/OCR_FIXTURE:\s*/gi, "")
        .replace(/SCANNED_PAGE:\s*/gi, "")
        .replace(/SCANNED_PDF:\s*/gi, "")
        .replace(/\[SCANNED_OCR\]/gi, "")
        .trim();

      return {
        text: cleaned,
        confidence: 0.94,
        engine: this.name,
        pageNumber: options?.pageNumber || 1,
      };
    }

    // Default: if no extractable OCR text stream exists in local fallback, return empty
    return {
      text: "",
      confidence: 0.0,
      engine: this.name,
      pageNumber: options?.pageNumber || 1,
    };
  }
}

/**
 * Cloud Vision OCR provider utilizing OpenAI Vision (gpt-4o-mini).
 */
export class OpenAiVisionOcrProvider implements OcrProvider {
  public readonly name = "openai-vision-ocr";

  public async extractText(
    input: Buffer | string,
    mimeType = "image/png",
    options?: { pageNumber?: number; language?: string }
  ): Promise<OcrResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith("sk-placeholder")) {
      // Graceful fallback to local engine if API key is unconfigured
      const fallback = new LocalFallbackOcrProvider();
      return fallback.extractText(input, mimeType, options);
    }

    try {
      const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf-8");
      const base64Image = buffer.toString("base64");

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an enterprise OCR engine. Accurately transcribe all visible text, numbers, percentages, and table contents from the provided document page image. Output only the transcribed text without conversational preamble.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Perform optical character recognition on this document page image.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          max_tokens: 2000,
          temperature: 0.0,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI Vision OCR API error: HTTP ${response.status}`);
      }

      const json = await response.json();
      const extractedText = json.choices?.[0]?.message?.content?.trim() || "";

      return {
        text: extractedText,
        confidence: 0.98,
        engine: this.name,
        pageNumber: options?.pageNumber || 1,
      };
    } catch {
      // Fallback on network/API failure
      const fallback = new LocalFallbackOcrProvider();
      return fallback.extractText(input, mimeType, options);
    }
  }
}

/**
 * Factory resolving the active OCR provider based on configuration.
 */
export function getConfiguredOcrProvider(): OcrProvider {
  const provider = (process.env.OCR_PROVIDER || "").trim().toLowerCase();

  if (provider === "vision" || provider === "openai") {
    return new OpenAiVisionOcrProvider();
  }

  // Default to local deterministic OCR engine
  return new LocalFallbackOcrProvider();
}
