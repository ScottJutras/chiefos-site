import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import OpenAI from "openai";

let clientSingleton: DocumentProcessorServiceClient | null = null;

function getClient() {
  if (clientSingleton) return clientSingleton;
  clientSingleton = new DocumentProcessorServiceClient();
  return clientSingleton;
}

function normalizeMime(mimeType: string | null | undefined) {
  const m = String(mimeType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (m === "image/jpg") return "image/jpeg";
  return m || "image/jpeg";
}

function pickEntity(entities: any[], type: string) {
  if (!Array.isArray(entities)) return null;
  return (
    entities.find(
      (x) => String(x?.type || "").toLowerCase() === String(type).toLowerCase()
    ) || null
  );
}

function entityMoney(entity: any): string | null {
  const props = entity?.normalizedValue?.moneyValue || entity?.mentionText || null;
  if (!props) return null;

  if (typeof props === "string") return props;

  const units = props.units != null ? String(props.units) : "0";
  const nanos = props.nanos != null ? String(props.nanos) : "0";
  return `${units}.${String(nanos).padStart(9, "0").slice(0, 2)}`;
}

export async function processExpenseReceipt(args: {
  projectId: string;
  processorId: string;
  location?: string;
  bytes: Buffer;
  mimeType?: string | null;
}) {
  const {
    projectId,
    processorId,
    location = "us",
    bytes,
    mimeType,
  } = args;

  if (!projectId) throw new Error("Missing projectId");
  if (!processorId) throw new Error("Missing processorId");
  if (!bytes || !Buffer.isBuffer(bytes)) throw new Error("Missing bytes Buffer");

  const client = getClient();
  const name = client.processorPath(projectId, location, processorId);

  const request = {
    name,
    rawDocument: {
      content: bytes.toString("base64"),
      mimeType: normalizeMime(mimeType),
    },
  };

  const [result] = await client.processDocument(request as any);

  const doc: any = result?.document || {};
  const text = doc?.text || "";
  const entities = Array.isArray(doc?.entities) ? doc.entities : [];

  const supplier = pickEntity(entities, "supplier_name")?.mentionText || null;
  const receiptDate = pickEntity(entities, "receipt_date")?.mentionText || null;
  const total =
    entityMoney(pickEntity(entities, "total_amount")) ||
    pickEntity(entities, "total_amount")?.mentionText ||
    null;
  const currency = pickEntity(entities, "currency")?.mentionText || null;

  return {
    text,
    fields: {
      supplier,
      receiptDate,
      total,
      currency,
    },
    raw: result || null,
  };
}

export async function extractReceiptWithVision(
  bytes: Buffer,
  mimeType: string
): Promise<{ text: string; fields: { supplier: string | null; receiptDate: string | null; total: string | null; currency: string | null } }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const client = new OpenAI({ apiKey });

  const base64 = bytes.toString("base64");
  const dataUrl = `data:${mimeType || "image/jpeg"};base64,${base64}`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
          {
            type: "text",
            text: `Extract the following from this receipt image and respond ONLY with valid JSON, no markdown:
{
  "supplier": "<vendor/store name or null>",
  "receiptDate": "<date in YYYY-MM-DD format or null>",
  "total": "<total amount as decimal string e.g. 12.50 or null>",
  "currency": "<3-letter currency code e.g. CAD, USD or null>",
  "rawText": "<full receipt text, newline-separated>"
}`,
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim() || "";

  try {
    const parsed = JSON.parse(content);
    return {
      text: parsed.rawText || "",
      fields: {
        supplier: parsed.supplier || null,
        receiptDate: parsed.receiptDate || null,
        total: parsed.total != null ? String(parsed.total) : null,
        currency: parsed.currency || null,
      },
    };
  } catch {
    // If JSON parse fails, return the raw content as text
    return {
      text: content,
      fields: { supplier: null, receiptDate: null, total: null, currency: null },
    };
  }
}