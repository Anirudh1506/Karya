import { DomainRuleViolation } from "./errors";

export class Identifier {
  private constructor(readonly value: string) {}

  static from(value: string, label = "Identifier"): Identifier {
    const normalized = value.trim();
    if (!normalized) {
      throw new DomainRuleViolation(`${label} cannot be empty`);
    }
    return new Identifier(normalized);
  }

  equals(other: Identifier): boolean {
    return this.value === other.value;
  }
}

export class Timestamp {
  private constructor(readonly value: string) {}

  static from(value: string): Timestamp {
    if (!value.trim()) {
      throw new DomainRuleViolation("Timestamp cannot be empty");
    }
    return new Timestamp(value);
  }
}

export class Label {
  private constructor(readonly value: string) {}

  static from(value: string): Label {
    const normalized = value.trim();
    if (!normalized) {
      throw new DomainRuleViolation("Label cannot be empty");
    }
    return new Label(normalized);
  }
}

export class Tag {
  private constructor(readonly value: string) {}

  static from(value: string): Tag {
    const normalized = value.trim().toLocaleLowerCase();
    if (!normalized) {
      throw new DomainRuleViolation("Tag cannot be empty");
    }
    return new Tag(normalized);
  }
}

export type Importance = "low" | "normal" | "high" | "critical";

export class Color {
  private constructor(readonly value: string) {}

  static from(value: string): Color {
    const normalized = value.trim();
    if (!normalized) {
      throw new DomainRuleViolation("Color cannot be empty");
    }
    return new Color(normalized);
  }
}
