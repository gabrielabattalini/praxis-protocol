export class PayloadTooLargeError extends Error {
  constructor(message = "Payload maior do que o limite permitido.") {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

export async function readJsonWithLimit<T>(
  request: Pick<Request, "text">,
  maxBytes: number,
) {
  const rawBody = await request.text();

  if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
    throw new PayloadTooLargeError();
  }

  if (!rawBody.trim()) {
    return {} as T;
  }

  return JSON.parse(rawBody) as T;
}
