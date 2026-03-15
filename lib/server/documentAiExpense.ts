import { DocumentProcessorServiceClient } from "@google-cloud/documentai";

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