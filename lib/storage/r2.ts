import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Reels live in a private Cloudflare R2 bucket (S3-compatible). Instagram only
// ever sees short-lived signed links, so the bucket itself is never public.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const accountId = requireEnv("R2_ACCOUNT_ID");
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return cachedClient;
}

function bucket(): string {
  return requireEnv("R2_BUCKET");
}

export interface ReelObject {
  key: string;
  size: number;
  lastModified: string | null;
}

/** Lists video files in the bucket so one can be chosen for scheduling. */
export async function listReelObjects(): Promise<ReelObject[]> {
  const out: ReelObject[] = [];
  let token: string | undefined;
  do {
    const page = await getClient().send(
      new ListObjectsV2Command({ Bucket: bucket(), ContinuationToken: token })
    );
    for (const item of page.Contents ?? []) {
      if (!item.Key || !/\.(mp4|mov)$/i.test(item.Key)) continue;
      out.push({
        key: item.Key,
        size: item.Size ?? 0,
        lastModified: item.LastModified?.toISOString() ?? null,
      });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

/** A time-limited link Instagram can fetch the video from. Default 2 hours. */
export async function getSignedReelUrl(
  key: string,
  expiresInSeconds = 2 * 60 * 60
): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

export async function deleteReelObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
