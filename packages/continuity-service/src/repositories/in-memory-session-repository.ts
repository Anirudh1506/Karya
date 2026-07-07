import type { SessionRepository } from "@karya/persistence";
import type { ContinuitySession, EntityId } from "@karya/types";

export class InMemorySessionRepository implements SessionRepository {
  private session: ContinuitySession;

  constructor(session: ContinuitySession) {
    this.session = session;
  }

  async list(): Promise<ContinuitySession[]> {
    return [this.session];
  }

  async get(id: EntityId): Promise<ContinuitySession | undefined> {
    return this.session.id === id ? this.session : undefined;
  }

  async save(session: ContinuitySession): Promise<void> {
    this.session = session;
  }

  async delete(): Promise<void> {}

  async getCurrent(): Promise<ContinuitySession | undefined> {
    return this.session;
  }

  async saveCurrent(session: ContinuitySession): Promise<void> {
    this.session = session;
  }
}
