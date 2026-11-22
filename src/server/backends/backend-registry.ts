import type { BackendInfo } from "../../shared/api.ts";
import type { BackendId } from "../../shared/ids.ts";
import type { BackendAdapter } from "./backend-adapter.ts";

export class UnknownBackendError extends Error {
  constructor(backendId: string) {
    super(`Unknown backend: ${backendId}`);
    this.name = "UnknownBackendError";
  }
}

export class BackendRegistry {
  private readonly adapters: Map<BackendId, BackendAdapter>;

  constructor(adapters: BackendAdapter[]) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  }

  get(backendId: BackendId): BackendAdapter {
    const adapter = this.adapters.get(backendId);
    if (!adapter) {
      throw new UnknownBackendError(backendId);
    }
    return adapter;
  }

  async describeAll(): Promise<BackendInfo[]> {
    return Promise.all([...this.adapters.values()].map(describeBackend));
  }
}

async function describeBackend(adapter: BackendAdapter): Promise<BackendInfo> {
  const [status, models] = await Promise.all([adapter.status(), adapter.listModels()]);
  return {
    id: adapter.id,
    displayName: adapter.displayName,
    available: status.available,
    statusDetail: status.detail,
    models,
  };
}
