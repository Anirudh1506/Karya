import type {
  KspConformanceAdapterFactory,
  KspConformanceCheck,
  KspConformanceReport,
  KspProtocolError,
  KspSessionRequest,
  KspTransportProfile,
} from "./contracts";
import { KspProtocolError as ProtocolError } from "./contracts";
import { KspReplicaSimulator } from "./replica-simulator";

const profiles: readonly KspTransportProfile[] = ["loopback", "http", "websocket", "lan", "bluetooth", "usb", "future"];

export async function runKspConformanceSuite(factory: KspConformanceAdapterFactory): Promise<KspConformanceReport> {
  const checks: KspConformanceCheck[] = [];

  await check(checks, "session lifecycle", async () => {
    const adapter = factory.create();
    const replica = new KspReplicaSimulator(adapter, "device:lifecycle");
    await replica.connect();
    await replica.heartbeat();
    ensure(
      replica.transitions.join(",") === "idle,connecting,authenticating,authorizing,negotiating,ready",
      "Session did not traverse every establishment boundary",
    );
    await replica.disconnect();
  });

  await check(checks, "authentication and authorization boundaries", async () => {
    await expectCode(
      () => factory.create().connect(sessionRequest("device:unauthenticated", { authenticated: false })),
      "unauthenticated",
    );
    await expectCode(
      () => factory.create().connect(sessionRequest("device:untrusted", { trusted: false })),
      "device-untrusted",
    );
    await expectCode(
      () => factory.create().connect(sessionRequest("device:unauthorized", { authorized: false })),
      "unauthorized",
    );
  });

  await check(checks, "version, capability, and extension compatibility", async () => {
    await expectCode(
      () =>
        factory.create().connect(
          sessionRequest("device:v2", {
            versions: { minimum: { major: 2, minor: 0 }, maximum: { major: 2, minor: 0 } },
          }),
        ),
      "protocol-version-unsupported",
    );
    const optionalAdapter = factory.create();
    const optional = await optionalAdapter.connect(
      sessionRequest("device:optional", {
        capabilities: [{ name: "future-optional", version: 1 }],
      }),
    );
    ensure(optional.negotiated.capabilities.length === 0, "Unknown optional capability was not disabled");
    ensure(
      (await optionalAdapter.handleExtension("future.optional", false, "correlation:optional")) === "ignored",
      "Unknown optional message was not ignored",
    );
    await expectCode(
      () => optionalAdapter.handleExtension("future.required", true, "correlation:required"),
      "capability-unsupported",
    );
    await expectCode(
      () =>
        factory.create().connect(
          sessionRequest("device:required-capability", {
            capabilities: [{ name: "future-required", version: 1, required: true }],
          }),
        ),
      "capability-unsupported",
    );
  });

  await check(checks, "idempotent upload, partial acknowledgement, and retry", async () => {
    const adapter = factory.create();
    const source = new KspReplicaSimulator(adapter, "device:upload", { batchSize: 8 });
    source.createOperation("one");
    source.createOperation("two");
    source.createOperation("three");
    adapter.injectFault("dependency-failure");
    await source.synchronize({ maximumWindows: 0 });
    const acceptedAfterPartial = source.state.accepted.size;
    ensure(acceptedAfterPartial === 3, "Partial acknowledgement did not preserve and finish the remainder");

    source.createOperation("accepted-before-response-loss");
    adapter.injectFault("lost-upload-response");
    await source.synchronizeWithRetry(2, { maximumWindows: 0 });
    const acceptedAfterRetry = source.state.accepted.size;
    ensure(acceptedAfterRetry === 4, "Lost upload acknowledgement did not converge idempotently");
    ensure(adapter.metrics().operationsAlreadyAccepted >= 1, "Duplicate upload was not recognized");
  });

  await check(checks, "replay receipts and duplicate delivery", async () => {
    const adapter = factory.create();
    const source = new KspReplicaSimulator(adapter, "device:source");
    source.createOperation("one");
    source.createOperation("two", ["operation:device:source:1"]);
    await source.synchronize({ maximumWindows: 0 });
    const destination = new KspReplicaSimulator(adapter, "device:destination");
    await destination.synchronize();
    const firstDigest = destination.digest();
    adapter.injectFault("duplicate-download");
    await destination.synchronize();
    ensure(destination.digest() !== "", "Replica digest was not produced");
    ensure(destination.state.receipts.size === 2, "Duplicate delivery created duplicate receipts");
    ensure(destination.state.replayOrder.length === 2, "Duplicate delivery reapplied product behavior");
    ensure(firstDigest === destination.digest(), "Duplicate redelivery changed durable replica state");
  });

  await check(checks, "replay interruption and durable restart", async () => {
    const adapter = factory.create();
    const source = new KspReplicaSimulator(adapter, "device:interrupt-source");
    for (let index = 0; index < 20; index += 1) source.createOperation(`payload:${index}`);
    await source.synchronize({ maximumWindows: 0 });
    let destination = new KspReplicaSimulator(adapter, "device:interrupt-destination", { batchSize: 20 });
    await expectCode(() => destination.synchronize({ interruptReplayAfter: 7 }), "transport-failure");
    ensure(destination.state.receipts.size === 7, "Partial replay receipts were not durable");
    destination = destination.restart();
    await destination.synchronize();
    ensure(destination.state.receipts.size === 20, "Restart did not resume the interrupted replay window");
    ensure(new Set(destination.state.replayOrder).size === 20, "Interrupted replay applied an operation twice");
  });

  await check(checks, "cursor opacity, corruption, expiration, and recovery", async () => {
    const adapter = factory.create();
    const source = new KspReplicaSimulator(adapter, "device:cursor-source");
    source.createOperation("cursor");
    await source.synchronize({ maximumWindows: 0 });
    const session = await adapter.connect(sessionRequest("device:cursor-target"));
    const window = await session.download(undefined, 10);
    ensure(window.candidateCursor.startsWith("opaque."), "Provider did not issue an opaque continuation token");
    await expectCode(() => session.download("client-invented-cursor", 10), "cursor-invalid");
    adapter.expireCursors();
    await expectCode(() => session.download(window.candidateCursor, 10), "cursor-expired");
    const recovered = await session.bootstrap(undefined, 10);
    ensure(recovered.operations.length === 1, "Bootstrap fallback did not restore expired history");
  });

  await check(checks, "bootstrap interruption, restart, and completion", async () => {
    const adapter = factory.create();
    const source = new KspReplicaSimulator(adapter, "device:bootstrap-source", { batchSize: 32 });
    for (let index = 0; index < 250; index += 1) source.createOperation(`bootstrap:${index}`);
    await source.synchronize({ maximumWindows: 0 });
    let destination = new KspReplicaSimulator(adapter, "device:bootstrap-target", { batchSize: 32 });
    await destination.bootstrap({ maximumWindows: 1 });
    ensure(
      !destination.state.ready && destination.state.receipts.size === 32,
      "Partial bootstrap boundary was incorrect",
    );
    destination = destination.restart();
    adapter.injectFault("bootstrap-failure");
    await expectCode(() => destination.bootstrap(), "transport-failure");
    destination = destination.restart();
    await destination.bootstrap();
    ensure(destination.state.ready, "Replica was marked unavailable after complete bootstrap");
    ensure(destination.state.receipts.size === 250, "Bootstrap skipped retained history");
  });

  await check(checks, "revocation and session failure model", async () => {
    const adapter = factory.create();
    const replica = new KspReplicaSimulator(adapter, "device:revoked");
    await replica.connect();
    adapter.revokeDevice(replica.deviceId);
    await expectCode(() => replica.heartbeat(), "device-revoked");
    await expectCode(() => replica.reconnect(), "device-revoked");
  });

  await check(checks, "transport-neutral outcomes", async () => {
    const digests: string[] = [];
    for (const profile of profiles) {
      const adapter = factory.create(profile);
      const source = new KspReplicaSimulator(adapter, "device:neutral-source", { batchSize: 8 });
      const destination = new KspReplicaSimulator(adapter, "device:neutral-destination", { batchSize: 8 });
      for (let index = 0; index < 25; index += 1) source.createOperation(`transport-neutral:${index}`);
      await source.synchronize({ maximumWindows: 0 });
      await destination.synchronize();
      digests.push(normalizedDigest(destination));
    }
    ensure(new Set(digests).size === 1, "Carrier profiles produced different replay outcomes");
  });

  let reportAdapter = factory.create();
  await check(checks, "observability and sensitive-data redaction", async () => {
    reportAdapter = factory.create();
    const replica = new KspReplicaSimulator(reportAdapter, "device:observability");
    replica.createOperation("SECRET-PRODUCT-PAYLOAD");
    await replica.synchronize({ maximumWindows: 0 });
    const diagnostics = JSON.stringify(reportAdapter.diagnostics());
    ensure(diagnostics.includes("correlation:"), "Correlation identifiers were not recorded");
    ensure(!diagnostics.includes("SECRET-PRODUCT-PAYLOAD"), "Protocol diagnostics exposed a product payload");
  });

  return {
    adapterId: factory.id,
    protocolVersion: "1.0",
    certified: checks.every(({ passed }) => passed),
    checks,
    metrics: reportAdapter.metrics(),
    diagnosticsRedacted:
      checks.find(({ name }) => name === "observability and sensitive-data redaction")?.passed ?? false,
  };
}

async function check(checks: KspConformanceCheck[], name: string, validate: () => Promise<void>): Promise<void> {
  try {
    await validate();
    checks.push({ name, passed: true, detail: "KSP v1.0 guarantee preserved" });
  } catch (error) {
    checks.push({ name, passed: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

async function expectCode(operation: () => Promise<unknown>, code: KspProtocolError["code"]): Promise<void> {
  try {
    await operation();
  } catch (error) {
    ensure(error instanceof ProtocolError, `Expected KspProtocolError, received ${String(error)}`);
    ensure(error.code === code, `Expected ${code}, received ${error.code}`);
    return;
  }
  throw new Error(`Expected protocol error: ${code}`);
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function normalizedDigest(replica: KspReplicaSimulator): string {
  const state = replica.state;
  return [
    [...state.receipts].sort().join(","),
    state.replayOrder.join(","),
    [...state.accepted].sort().join(","),
    String(state.ready),
  ].join("|");
}

function sessionRequest(deviceId: string, overrides: Partial<KspSessionRequest> = {}): KspSessionRequest {
  return {
    accountId: "account:ksp",
    deviceId,
    authenticated: true,
    authorized: true,
    trusted: true,
    versions: { minimum: { major: 1, minor: 0 }, maximum: { major: 1, minor: 0 } },
    envelopeVersions: [1],
    operationVersions: { "karya.test": [1], "*": [1] },
    capabilities: [{ name: "background-sync", version: 1 }],
    correlationId: `correlation:${deviceId}`,
    ...overrides,
  };
}
