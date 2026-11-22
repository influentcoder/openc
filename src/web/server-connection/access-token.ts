const storageKey = "openc.accessToken";

export function resolveAccessToken(location: Location, history: History): string | null {
  const url = new URL(location.href);
  const tokenFromUrl = url.searchParams.get("token");
  if (tokenFromUrl) {
    writeStoredToken(tokenFromUrl);
    url.searchParams.delete("token");
    history.replaceState(null, "", url.toString());
    return tokenFromUrl;
  }
  return readStoredToken();
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string): void {
  try {
    localStorage.setItem(storageKey, token);
  } catch {
    return;
  }
}
