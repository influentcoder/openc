export function browserLink(options: {
  serverUrl: string;
  webUrl: string | undefined;
  token: string;
}): string {
  const link = new URL("/", options.webUrl ?? options.serverUrl);
  link.searchParams.set("token", options.token);
  return link.toString();
}
