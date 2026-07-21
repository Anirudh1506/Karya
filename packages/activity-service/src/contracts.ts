import type { ActivityCategory, ActivityObjectReference, ActivityVerb, EntityId, KaryaActivity } from "@karya/types";

export interface RecordActivityRequest {
  eventType?: string;
  category: ActivityCategory;
  verb: ActivityVerb;
  title: string;
  description?: string;
  object: ActivityObjectReference;
  relatedObjects?: ActivityObjectReference[];
  profileId?: EntityId;
  workspaceId?: EntityId;
  applicationId?: EntityId;
  source: string;
  groupKey?: string;
  occurredAt?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ActivityRetentionPolicy {
  mode: "retain-all";
  queryLimit: number;
}

export interface ActivityFilter {
  profileId?: EntityId;
  workspaceId?: EntityId;
  objectId?: EntityId;
  objectType?: ActivityObjectReference["type"];
  category?: ActivityCategory;
  applicationId?: EntityId;
  eventType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface ActivityService {
  record(request: RecordActivityRequest): Promise<KaryaActivity>;
  list(filter?: ActivityFilter): Promise<KaryaActivity[]>;
  get(id: EntityId): Promise<KaryaActivity | undefined>;
  recent(limit?: number): Promise<KaryaActivity[]>;
  byProfile(profileId: EntityId, limit?: number): Promise<KaryaActivity[]>;
  byWorkspace(workspaceId: EntityId, limit?: number): Promise<KaryaActivity[]>;
  byResource(resourceId: EntityId, limit?: number): Promise<KaryaActivity[]>;
  byEventType(eventType: string, limit?: number): Promise<KaryaActivity[]>;
  latest(filter?: ActivityFilter): Promise<KaryaActivity | undefined>;
  getRetentionPolicy(): ActivityRetentionPolicy;
  subscribe(listener: (activity: KaryaActivity) => void | Promise<void>): () => void;
  subscribeToEvents(): () => void;
}
