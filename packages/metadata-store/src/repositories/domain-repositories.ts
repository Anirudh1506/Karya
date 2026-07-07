/// <reference path="../better-sqlite3.d.ts" />
import { Identifier, Resource as ResourceAggregate, Workspace as WorkspaceAggregate, type ResourceRepository as DomainResourceRepository, type WorkspaceRepository as DomainWorkspaceRepository } from "@karya/domain";
import { toDomain as resourceToDomain, toDto as resourceToDto } from "@karya/resource-service";
import { toDomain as workspaceToDomain, toDto as workspaceToDto } from "@karya/workspace-service";
import type { Resource, Workspace } from "@karya/types";
import type { Database } from "better-sqlite3";
import { parseJson, serializeJson } from "../json";
import type { PayloadRow } from "./rows";

export class SqliteResourceRepository implements DomainResourceRepository {
  constructor(private readonly database: Database) {}

  async save(resource: ResourceAggregate): Promise<void> {
    const dto = resourceToDto(resource);
    const save = this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO resources (id, type, title, profile_id, owner_id, lifecycle_state, created_at, updated_at, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          title = excluded.title,
          profile_id = excluded.profile_id,
          owner_id = excluded.owner_id,
          lifecycle_state = excluded.lifecycle_state,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          payload = excluded.payload
      `).run(
        dto.id,
        dto.type,
        dto.metadata.title,
        dto.profileId,
        dto.owner,
        dto.lifecycleState,
        dto.createdAt,
        dto.updatedAt,
        serializeJson(dto),
      );

      this.database.prepare("DELETE FROM resource_tags WHERE resource_id = ?").run(dto.id);
      dto.tags.forEach((tag) => {
        this.database.prepare("INSERT OR IGNORE INTO resource_tags (resource_id, tag) VALUES (?, ?)").run(dto.id, tag);
      });

      this.database.prepare("DELETE FROM relationships WHERE source_resource_id = ?").run(dto.id);
      dto.relationships.forEach((relationship) => {
        this.database.prepare(`
          INSERT INTO relationships (id, source_resource_id, target_resource_id, type, payload)
          VALUES (?, ?, ?, ?, ?)
        `).run(relationship.id, dto.id, relationship.targetResourceId, relationship.type, serializeJson(relationship));
      });
    });
    save();
  }

  async findById(id: Identifier): Promise<ResourceAggregate | undefined> {
    const row = this.database.prepare("SELECT payload FROM resources WHERE id = ?").get(id.value) as PayloadRow | undefined;
    return row ? resourceToDomain(parseJson<Resource>(row.payload)) : undefined;
  }

  async list(): Promise<ResourceAggregate[]> {
    return (this.database.prepare("SELECT payload FROM resources ORDER BY updated_at DESC").all() as PayloadRow[])
      .map((row) => resourceToDomain(parseJson<Resource>(row.payload)));
  }
}

export class SqliteWorkspaceRepository implements DomainWorkspaceRepository {
  constructor(private readonly database: Database) {}

  async save(workspace: WorkspaceAggregate): Promise<void> {
    const dto = workspaceToDto(workspace);
    const save = this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO workspaces (id, name, profile_id, owner_id, lifecycle_state, pinned, favorite, created_at, updated_at, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          profile_id = excluded.profile_id,
          owner_id = excluded.owner_id,
          lifecycle_state = excluded.lifecycle_state,
          pinned = excluded.pinned,
          favorite = excluded.favorite,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          payload = excluded.payload
      `).run(
        dto.id,
        dto.name,
        dto.profileId,
        dto.owner,
        dto.lifecycleState,
        dto.pinned ? 1 : 0,
        dto.favorite ? 1 : 0,
        dto.createdAt,
        dto.updatedAt,
        serializeJson(dto),
      );

      this.database.prepare("DELETE FROM workspace_resources WHERE workspace_id = ?").run(dto.id);
      dto.resourceRefs.forEach((resourceId) => {
        this.database.prepare("INSERT OR IGNORE INTO workspace_resources (workspace_id, resource_id) VALUES (?, ?)").run(dto.id, resourceId);
      });
    });
    save();
  }

  async findById(id: Identifier): Promise<WorkspaceAggregate | undefined> {
    const row = this.database.prepare("SELECT payload FROM workspaces WHERE id = ?").get(id.value) as PayloadRow | undefined;
    return row ? workspaceToDomain(parseJson<Workspace>(row.payload)) : undefined;
  }

  async list(): Promise<WorkspaceAggregate[]> {
    return (this.database.prepare("SELECT payload FROM workspaces ORDER BY updated_at DESC").all() as PayloadRow[])
      .map((row) => workspaceToDomain(parseJson<Workspace>(row.payload)));
  }
}
