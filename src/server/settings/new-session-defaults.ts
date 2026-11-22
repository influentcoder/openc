import { z } from "zod";
import type { NewSessionDefaults } from "../../shared/api.ts";
import { BackendIdSchema } from "../../shared/ids.ts";
import { WorkspaceModeSchema } from "../../shared/session.ts";
import type { SettingsRepository } from "./settings-repository.ts";

const settingsKey = "new-session-defaults";
const recentDirectoryLimit = 8;

const RememberedChoicesSchema = z.object({
  backendId: BackendIdSchema,
  model: z.string(),
  workspaceMode: WorkspaceModeSchema,
});
export type RememberedChoices = z.infer<typeof RememberedChoicesSchema>;

export interface RecentDirectorySource {
  recentDirectories(limit: number): string[];
}

export class NewSessionDefaultsService {
  private readonly settings: SettingsRepository;
  private readonly recentDirectorySource: RecentDirectorySource;
  private readonly browseRoot: string;

  constructor(
    settings: SettingsRepository,
    recentDirectorySource: RecentDirectorySource,
    browseRoot: string,
  ) {
    this.settings = settings;
    this.recentDirectorySource = recentDirectorySource;
    this.browseRoot = browseRoot;
  }

  remember(choices: RememberedChoices): void {
    this.settings.write(settingsKey, choices);
  }

  current(): NewSessionDefaults {
    const remembered = this.settings.read(settingsKey, RememberedChoicesSchema);
    return {
      backendId: remembered?.backendId ?? null,
      model: remembered?.model ?? null,
      workspaceMode: remembered?.workspaceMode ?? "scratch",
      recentDirectories: this.recentDirectorySource.recentDirectories(recentDirectoryLimit),
      browseRoot: this.browseRoot,
    };
  }
}
