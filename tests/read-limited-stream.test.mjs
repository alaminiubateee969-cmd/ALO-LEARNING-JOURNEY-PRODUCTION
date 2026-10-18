import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BodyTooLargeError, readLimitedStream } from "../src/lib/read-limited-stream.mjs";

const familyRoute = await readFile(new URL("../src/app/api/family-studio/route.ts", import.meta.url), "utf8");

test("reads a request body exactly up to the configured byte limit", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
      controller.enqueue(new Uint8Array([3, 4]));
      controller.close();
    },
  });

  assert.deepEqual(await readLimitedStream(stream, 4), new Uint8Array([1, 2, 3, 4]));
});

test("cancels an oversized request body without buffering it to completion", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(3));
      controller.enqueue(new Uint8Array(4));
    },
    cancel() {
      cancelled = true;
    },
  });

  await assert.rejects(readLimitedStream(stream, 6), BodyTooLargeError);
  assert.equal(cancelled, true);
});

test("treats an absent request body as an empty byte sequence", async () => {
  assert.deepEqual(await readLimitedStream(null, 0), new Uint8Array());
});

test("bounded request bytes can be replayed through multipart form parsing", async () => {
  const boundary = "alo-test-boundary";
  const payload = `--${boundary}\r\nContent-Disposition: form-data; name="profileId"\r\n\r\np1\r\n--${boundary}--\r\n`;
  const original = new Request("http://localhost/api/family-studio", {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body: payload,
  });
  const bounded = await readLimitedStream(original.body, 1024);
  const requestBody = new ArrayBuffer(bounded.byteLength);
  new Uint8Array(requestBody).set(bounded);
  const replay = new Request(original.url, {
    method: original.method,
    headers: original.headers,
    body: requestBody,
  });

  assert.equal((await replay.formData()).get("profileId"), "p1");
});

test("rejects invalid byte limits", async () => {
  await assert.rejects(readLimitedStream(null, -1), RangeError);
  await assert.rejects(readLimitedStream(null, Number.POSITIVE_INFINITY), RangeError);
});

test("family uploads are stream-bounded before multipart parsing and map overflow to HTTP 413", () => {
  const read = familyRoute.indexOf("readLimitedStream(req.body, MAX_UPLOAD_REQUEST_BYTES)");
  const parse = familyRoute.indexOf("boundedRequest.formData()", read);
  assert.ok(read >= 0 && parse > read);
  assert.match(familyRoute, /MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BATCH_BYTES \+ 256 \* 1024/);
  assert.match(familyRoute, /error instanceof BodyTooLargeError[\s\S]*?status: 413/);
});
