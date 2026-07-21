import type { KspOperationEnvelope } from "./contracts";

export function orderEnvelopes(operations: readonly KspOperationEnvelope[]): KspOperationEnvelope[] {
  return [...operations].sort(
    (left, right) =>
      left.timestamp.localeCompare(right.timestamp) ||
      left.originDeviceId.localeCompare(right.originDeviceId) ||
      left.deviceSequence - right.deviceSequence ||
      left.operationId.localeCompare(right.operationId),
  );
}

export function sameEnvelope(left: KspOperationEnvelope, right: KspOperationEnvelope): boolean {
  return (
    left.operationId === right.operationId &&
    left.accountId === right.accountId &&
    left.originDeviceId === right.originDeviceId &&
    left.operationType === right.operationType &&
    left.operationVersion === right.operationVersion &&
    left.deviceSequence === right.deviceSequence &&
    left.timestamp === right.timestamp &&
    left.payload === right.payload &&
    left.envelopeVersion === right.envelopeVersion &&
    equalStrings(left.dependencies, right.dependencies) &&
    left.capability?.name === right.capability?.name &&
    left.capability?.version === right.capability?.version
  );
}

function equalStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
