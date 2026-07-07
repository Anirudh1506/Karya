import type { ActivityCategory, ActivityObjectReference, ActivityVerb, EntityId, KaryaActivity } from "@karya/types";

export interface RecordActivityRequest {
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

export interface ActivityFilter {
  profileId?: EntityId;
  workspaceId?: EntityId;
  objectId?: EntityId;
  objectType?: ActivityObjectReference["type"];
  category?: ActivityCategory;
  applicationId?: EntityId;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface ActivityService {
  record(request: RecordActivityRequest): Promise<KaryaActivity>;
  list(filter?: ActivityFilter): Promise<KaryaActivity[]>;
  get(id: EntityId): Promise<KaryaActivity | undefined>;
  subscribeToEvents(): () => void;
}
