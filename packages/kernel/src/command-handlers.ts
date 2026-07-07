import type { CommandBus } from "./command-bus";
import { registerNativeResourceCommandHandlers } from "./command-handlers/registrations/native-resource-commands";
import { registerImportFolderCommandHandlers } from "./command-handlers/registrations/import-folder-commands";
import { registerResourceCommandHandlers } from "./command-handlers/registrations/resource-commands";
import { registerWorkspaceProfileApplicationCommandHandlers } from "./command-handlers/registrations/workspace-profile-application-commands";
import { registerSessionSearchCommandHandlers } from "./command-handlers/registrations/session-search-commands";

export function registerCommandHandlers(commandBus: CommandBus): void {
  registerNativeResourceCommandHandlers(commandBus);
  registerImportFolderCommandHandlers(commandBus);
  registerResourceCommandHandlers(commandBus);
  registerWorkspaceProfileApplicationCommandHandlers(commandBus);
  registerSessionSearchCommandHandlers(commandBus);
}
