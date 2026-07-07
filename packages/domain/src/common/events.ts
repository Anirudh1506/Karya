import type { Timestamp } from "./value-objects";

export interface DomainEvent<TName extends string, TPayload> {
  name: TName;
  payload: TPayload;
  occurredAt: Timestamp;
}
