/**
 * Read a request body while enforcing a hard byte limit.
 *
 * Used by upload routes (`/api/family-studio`) so an oversized multipart body
 * is rejected *before* it is buffered and parsed. Behaviour:
 *
 *   - `maxBytes` must be a non-negative safe integer, otherwise RangeError.
 *   - A missing body (`null`/`undefined`) reads as an empty byte sequence.
 *   - Exceeding the limit throws {@link BodyTooLargeError} and cancels the
 *     source stream instead of draining the rest of it.
 *
 * Returns a `Uint8Array` copy of the body, which can be replayed into a new
 * `Request` for `formData()` parsing.
 */

export class BodyTooLargeError extends Error {
  constructor(maxBytes) {
    super(`Request body exceeded ${maxBytes} bytes`);
    this.name = 'BodyTooLargeError';
    this.statusCode = 413;
  }
}

function toBytes(chunk) {
  if (chunk instanceof Uint8Array) return chunk;
  if (typeof chunk === 'string') return new TextEncoder().encode(chunk);
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
  if (ArrayBuffer.isView(chunk)) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  throw new TypeError('Stream chunks must be byte arrays or strings');
}

function assemble(chunks, totalBytes) {
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readLimitedStream(stream, maxBytes) {
  if (typeof maxBytes !== 'number' || !Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError(
      `maxBytes must be a non-negative safe integer (received ${String(maxBytes)})`,
    );
  }

  if (stream === null || stream === undefined) return new Uint8Array(0);

  const chunks = [];
  let totalBytes = 0;

  // Web streams (including `Request#body`) expose getReader(), which lets us
  // cancel explicitly on overflow. Node streams and async iterables fall back
  // to `for await`; abandoning that iterator also cancels the source.
  if (typeof stream.getReader === 'function') {
    const reader = stream.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = toBytes(value);
        totalBytes += chunk.byteLength;
        if (totalBytes > maxBytes) throw new BodyTooLargeError(maxBytes);
        chunks.push(chunk);
      }
    } catch (error) {
      await reader.cancel(error).catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock?.();
    }
    return assemble(chunks, totalBytes);
  }

  const iterator =
    typeof stream[Symbol.asyncIterator] === 'function'
      ? stream[Symbol.asyncIterator]()
      : null;

  if (!iterator) {
    throw new TypeError('Body is not a readable stream');
  }

  try {
    for (;;) {
      const { value, done } = await iterator.next();
      if (done) break;
      const chunk = toBytes(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) throw new BodyTooLargeError(maxBytes);
      chunks.push(chunk);
    }
  } catch (error) {
    await iterator.return?.().catch(() => undefined);
    throw error;
  }

  return assemble(chunks, totalBytes);
}

export default readLimitedStream;
