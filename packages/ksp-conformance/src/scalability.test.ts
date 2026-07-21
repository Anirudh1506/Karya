import { describe, expect, it } from "vitest";
import { ReferenceKspAdapterFactory } from "./reference-adapter";
import { CompactReceiptLedger, validateKspScalability } from "./scalability";

describe("KSP architectural scalability", () => {
  it("validates 100,000 operations, 100 replicas, one million receipts, and a long-running session", async () => {
    const finding = await validateKspScalability(new ReferenceKspAdapterFactory());

    expect(finding.replicas).toBe(100);
    expect(finding.operations).toBe(100_000);
    expect(finding.replayedOperations).toBe(100_000);
    expect(finding.uniqueReceipts).toBe(1_000_000);
    expect(finding.longRunningCycles).toBe(1_000);
    expect(finding.deterministic).toBe(true);
    expect(finding.historyComplete).toBe(true);
    expect(finding.durationMs).toBeGreaterThan(0);
  }, 120_000);

  it("keeps duplicate receipt insertion idempotent with compact bounded storage", () => {
    const ledger = new CompactReceiptLedger(10);
    expect(ledger.add(3)).toBe(true);
    expect(ledger.add(3)).toBe(false);
    expect(ledger.has(3)).toBe(true);
    expect(ledger.size).toBe(1);
  });
});
