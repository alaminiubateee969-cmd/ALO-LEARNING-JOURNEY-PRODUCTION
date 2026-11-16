import test from "node:test";
import { execFileSync } from "node:child_process";

test("gateway enforces separate identities, image input is safe, and status reports actual model readiness", () => {
  execFileSync(process.execPath, ["--import", "tsx", "tests/helpers/ai-routes-check.ts"], { stdio: "pipe", timeout: 30000 });
});
