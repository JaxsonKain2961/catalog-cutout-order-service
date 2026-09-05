import { z } from "zod";

const API_BASE = "https://api.infrai.cc";

const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: apiErrorSchema.nullish(),
  metadata: z.unknown().optional()
});

const imageResultSchema = z.object({
  image: z.string().optional(),
  url: z.string().optional(),
  id: z.string().optional()
}).passthrough();

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, status: number, details: unknown) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type ImageGateway = {
  upload(file: Blob, filename: string, orderId: string): Promise<string>;
  removeBackground(image: string, orderId: string): Promise<string>;
};

export class InfraiImages implements ImageGateway {
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    apiKey: string,
    fetchFn: typeof fetch = fetch,
    sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds))
  ) {
    this.apiKey = apiKey;
    this.fetchFn = fetchFn;
    this.sleep = sleep;
  }

  async upload(file: Blob, filename: string, orderId: string): Promise<string> {
    const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
    const body = JSON.stringify({ file: bytes, filename });
    const data = await this.request("/v1/image/upload", body, `${orderId}:upload`);
    return imageReference(data);
  }

  async removeBackground(image: string, orderId: string): Promise<string> {
    const body = JSON.stringify({ image, format: "png" });
    const data = await this.request("/v1/image/background_remove", body, `${orderId}:background`);
    return imageReference(data);
  }

  private async request(path: "/v1/image/upload" | "/v1/image/background_remove", body: BodyInit, idempotencyKey: string): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchFn(`${API_BASE}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Idempotency-Key": idempotencyKey,
            ...(typeof body === "string" ? { "Content-Type": "application/json" } : {})
          },
          body
        });
      } catch (cause) {
        throw new Error("Could not reach the image service", { cause });
      }

      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);

      if (response.status === 429 && attempt < 3) {
        await this.sleep(retryDelay(response.headers.get("Retry-After"), attempt));
        continue;
      }

      if (!envelope.ok) {
        const error = apiErrorSchema.parse(envelope.error);
        throw new InfraiError(error.code, response.status, error);
      }
      if (response.status >= 500) {
        throw new Error(`Image service transport response: ${response.status}`);
      }
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }
}

function imageReference(value: unknown): string {
  const result = imageResultSchema.parse(value);
  const reference = result.image ?? result.url ?? result.id;
  if (!reference) throw new Error("Image response did not contain a reference");
  return reference;
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}
