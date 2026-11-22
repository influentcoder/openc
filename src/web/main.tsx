import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { resolveAccessToken } from "./api/access-token.ts";
import { createHttpApiClient } from "./api/api-client.ts";
import { WebSocketLiveConnection } from "./api/live-connection.ts";
import { App } from "./app/App.tsx";
import { ServicesProvider } from "./app/services.tsx";
import "./styles.css";

function liveUrl(token: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
}

function MissingToken() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-400">
      Open openc with the link printed by the server (it contains the access token).
    </div>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element");
}
const token = resolveAccessToken(window.location, window.history);
const queryClient = new QueryClient();

createRoot(rootElement).render(
  <StrictMode>
    {token ? (
      <QueryClientProvider client={queryClient}>
        <ServicesProvider
          services={{
            api: createHttpApiClient(token, window.fetch.bind(window)),
            live: new WebSocketLiveConnection(liveUrl(token)),
          }}
        >
          <App />
        </ServicesProvider>
      </QueryClientProvider>
    ) : (
      <MissingToken />
    )}
  </StrictMode>,
);
