export class BodyTooLargeError extends Error {
  constructor(maxBytes) {
    super(`Request body exceeded ${maxBytes} bytes`);
    this.name = 'BodyTooLargeError';
    this.statusCode = 413;
  }
}

export async function readLimitedStream(stream, maxBytes) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of stream) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      throw new BodyTooLargeError(maxBytes);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default readLimitedStream;
