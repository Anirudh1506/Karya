import { describe, expect, it } from "vitest";
import { KspProtocolError } from "./contracts";
import { runKspConformanceSuite } from "./harness";
import { ReferenceKspAdapterFactory } from "./reference-adapter";
import { KspReplicaSimulator } from "./replica-simulator";

describe("KSP v1.0 reference conformance", () => {
  it("certifies the reference adapter against every constitutional check", async () => {
    const report = await runKspConformanceSuite(new ReferenceKspAdapterFactory());

    expect(report.checks.filter(({ passed }) => !passed)).toEqual([]);
    expect(report.certified).toBe(true);
    expect(report.protocolVersion).toBe("1.0");
    expect(report.diagnosticsRedacted).toBe(true);
  });

  it.each([1, 2, 5, 25, 100])("supports %i logical replica(s) without physical devices", async (count) => {
    const adapter = new ReferenceKspAdapterFactory().create();
    const replicas = Array.from(
      { length: count },
      (_, index) => new KspReplicaSimulator(adapter, `device:population:${index}`),
    );

    await Promise.all(replicas.map((replica) => replica.connect()));

    expect(adapter.metrics().sessionsReady).toBe(count);
  });

  it("classifies maintenance, transport, session, and dependency failures deterministically", async () => {
    const factory = new ReferenceKspAdapterFactory();

    const maintenance = factory.create();
    maintenance.injectFault("maintenance");
    await expectCode(() => new KspReplicaSimulator(maintenance, "device:maintenance").connect(), "maintenance");

    const network = factory.create();
    const offlineReplica = new KspReplicaSimulator(network, "device:offline");
    await offlineReplica.connect();
    network.injectFault("network-failure");
    await expectCode(() => offlineReplica.heartbeat(), "transport-failure");

    const expired = factory.create();
    const expiredReplica = new KspReplicaSimulator(expired, "device:expired");
    await expiredReplica.connect();
    expired.injectFault("expired-session");
    await expectCode(() => expiredReplica.heartbeat(), "session-expired");

    const dependency = factory.create();
    const source = new KspReplicaSimulator(dependency, "device:dependency-source");
    source.createOperation("missing", ["operation:never-arrives"]);
    await source.synchronize({ maximumWindows: 0 });
    const target = new KspReplicaSimulator(dependency, "device:dependency-target");
    await expectCode(() => target.synchronize(), "dependency-missing");
  });
});

async function expectCode(operation: () => Promise<unknown>, code: KspProtocolError["code"]): Promise<void> {
  try {
    await operation();
  } catch (error) {
    expect(error).toBeInstanceOf(KspProtocolError);
    expect((error as KspProtocolError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}
