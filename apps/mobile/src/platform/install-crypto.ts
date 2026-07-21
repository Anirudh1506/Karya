import { getRandomValues, randomUUID } from "expo-crypto";

const existingCrypto = globalThis.crypto;

if (!existingCrypto) {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues,
      randomUUID,
    } as unknown as Crypto,
  });
} else {
  if (typeof existingCrypto.getRandomValues !== "function") {
    Object.defineProperty(existingCrypto, "getRandomValues", { configurable: true, value: getRandomValues });
  }
  if (typeof existingCrypto.randomUUID !== "function") {
    Object.defineProperty(existingCrypto, "randomUUID", { configurable: true, value: randomUUID });
  }
}
