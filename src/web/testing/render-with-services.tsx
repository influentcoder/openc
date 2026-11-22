import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { ServicesProvider } from "../app/services.tsx";
import { FakeApiClient } from "./fake-api-client.ts";
import { FakeLiveConnection } from "./fake-live-connection.ts";

export function renderWithServices(element: ReactElement) {
  const api = new FakeApiClient();
  const live = new FakeLiveConnection();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const renderResult = (ui: ReactElement) =>
    render(
      <QueryClientProvider client={queryClient}>
        <ServicesProvider services={{ api, live }}>{ui}</ServicesProvider>
      </QueryClientProvider>,
    );
  return { api, live, queryClient, render: () => renderResult(element) };
}
