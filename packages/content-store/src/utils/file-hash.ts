import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import type { ContentAddress } from "@karya/types";

export async function streamFileWithHash(sourcePath: string, destinationPath: string): Promise<{
  address: ContentAddress;
  byteLength: number;
  header: Uint8Array;
}> {
  const hash = createHash("sha256");
  const source = createReadStream(sourcePath);
  const destination = createWriteStream(destinationPath, { flags: "wx" });
  const headerChunks: Buffer[] = [];
  let headerLength = 0;
  let byteLength = 0;

  await new Promise<void>((resolve, reject) => {
    source.on("data", (chunk: string | Buffer) => {
      const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      hash.update(buffer);
      byteLength += buffer.byteLength;
      if (headerLength < 512) {
        const next = buffer.subarray(0, 512 - headerLength);
        headerChunks.push(next);
        headerLength += next.byteLength;
      }
    });
    source.on("error", reject);
    destination.on("error", reject);
    destination.on("finish", resolve);
    source.pipe(destination);
  });

  return {
    address: hash.digest("hex"),
    byteLength,
    header: Buffer.concat(headerChunks),
  };
}

export async function hashFile(path: string): Promise<ContentAddress> {
  const hash = createHash("sha256");
  const handle = await open(path, "r");
  try {
    for await (const chunk of handle.createReadStream()) {
      hash.update(chunk);
    }
  } finally {
    await handle.close();
  }
  return hash.digest("hex");
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
