import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const tokenFileName = "token";

export async function loadOrCreateAccessToken(dataDirectory: string): Promise<string> {
  const path = join(dataDirectory, tokenFileName);
  try {
    return (await readFile(path, "utf8")).trim();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
  const token = randomBytes(24).toString("base64url");
  await writeFile(path, token, { mode: 0o600 });
  return token;
}
