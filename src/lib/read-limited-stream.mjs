export class BodyTooLargeError extends Error {
  constructor() {
    super("request_body_too_large");
    this.name = "BodyTooLargeError";
  }
}

/**
 * Read a Web ReadableStream while enforcing a byte ceiling, independent of any
 * Content-Length header. The reader is cancelled as soon as the bound is hit.
 *
 * @param {ReadableStream<Uint8Array> | null} stream
 * @param {number} maxBytes
 * @returns {Promise<Uint8Array>}
 */
export async function readLimitedStream(stream, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError("maxBytes must be a non-negative safe integer");
  }
  if (!stream) return new Uint8Array();

  const reader = stream.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (totalBytes + value.byteLength > maxBytes) {
        try {
          await reader.cancel("request_body_too_large");
        } catch {
          // Cancellation is best-effort; the hard bound is still enforced.
        }
        throw new BodyTooLargeError();
      }
      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
