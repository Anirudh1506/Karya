export class Metadata {
  private constructor(readonly values: Record<string, string | number | boolean | null>) {}

  static from(values: Record<string, string | number | boolean | null> = {}): Metadata {
    return new Metadata({ ...values });
  }
}
