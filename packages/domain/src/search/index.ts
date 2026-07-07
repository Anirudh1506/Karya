import { DomainRuleViolation } from "../common";

export class SearchQuery {
  private constructor(readonly value: string) {}

  static from(value: string): SearchQuery {
    return new SearchQuery(value.trim());
  }

  isEmpty(): boolean {
    return this.value.length === 0;
  }
}

export type SearchScope = "global" | "profile" | "workspace" | "resource" | "application" | "command" | "setting";

export interface SearchFilter {
  scope: SearchScope;
  tag?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  scope: SearchScope;
  score: number;
}

export class RankedSearchResult {
  private constructor(readonly result: SearchResult) {
    if (result.score < 0) {
      throw new DomainRuleViolation("Search result score cannot be negative");
    }
  }

  static from(result: SearchResult): RankedSearchResult {
    return new RankedSearchResult(result);
  }
}
