import { timingSafeEqual } from "node:crypto";

const loopbackHostnames = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function isLoopbackHost(hostHeader: string | undefined | null): boolean {
  if (!hostHeader) {
    return false;
  }
  const hostname = hostHeader.startsWith("[")
    ? hostHeader.slice(0, hostHeader.indexOf("]") + 1)
    : (hostHeader.split(":")[0] ?? "");
  return loopbackHostnames.has(hostname);
}

export function isAllowedOrigin(originHeader: string | undefined | null): boolean {
  if (!originHeader) {
    return true;
  }
  try {
    return isLoopbackHost(new URL(originHeader).host);
  } catch {
    return false;
  }
}

export function tokensMatch(expected: string, provided: string | undefined | null): boolean {
  if (!provided) {
    return false;
  }
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return (
    expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes)
  );
}

export function bearerToken(authorizationHeader: string | undefined): string | undefined {
  const prefix = "Bearer ";
  return authorizationHeader?.startsWith(prefix)
    ? authorizationHeader.slice(prefix.length)
    : undefined;
}
