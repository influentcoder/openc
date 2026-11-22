import { createContext, type ReactNode, useContext } from "react";
import type { ApiClient } from "../api/api-client.ts";
import type { LiveConnection } from "../api/live-connection.ts";

export interface ClientServices {
  api: ApiClient;
  live: LiveConnection;
}

const ServicesContext = createContext<ClientServices | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: ClientServices;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): ClientServices {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error("useServices must be used inside ServicesProvider");
  }
  return services;
}
