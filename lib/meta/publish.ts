import { getMetaGraphApiVersion } from "@/lib/env";
import { MetaApiError, resolveInstagramAccountId } from "@/lib/meta/client";

// Instagram content publishing (reels) over the Graph API.
// Flow: create a REELS container from a video URL, wait until Instagram has
// downloaded and processed it, then publish the container and read the media id.

function graphBase() {
  return `https://graph.facebook.com/${getMetaGraphApiVersion()}`;
}

interface GraphErrorBody {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

async function graphRequest<T>(
  url: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const response = await fetchImpl(url, init);
  const body = (await response.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!response.ok || body.error) {
    const err = body.error;
    throw new MetaApiError(
      err?.code ?? response.status,
      err?.error_subcode,
      err?.fbtrace_id,
      err?.message ?? `Graph API request failed with status ${response.status}`
    );
  }
  return body;
}

export interface CreateReelContainerInput {
  accessToken: string;
  videoUrl: string;
  caption: string;
  shareToFeed?: boolean;
  /** Optional IG professional account ID; skips /me/assigned_instagram_accounts lookup when supplied. */
  instagramId?: string;
}

export async function createReelContainer(
  input: CreateReelContainerInput,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const igId = input.instagramId ?? (await resolveInstagramAccountId(input.accessToken));
  const params = new URLSearchParams({
    media_type: "REELS",
    video_url: input.videoUrl,
    caption: input.caption,
    share_to_feed: String(input.shareToFeed ?? true),
    access_token: input.accessToken,
  });
  const body = await graphRequest<{ id: string }>(
    `${graphBase()}/${igId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
    fetchImpl
  );
  return body.id;
}

export type ContainerStatus =
  | "EXPIRED"
  | "ERROR"
  | "FINISHED"
  | "IN_PROGRESS"
  | "PUBLISHED";

export async function getContainerStatus(
  accessToken: string,
  containerId: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ statusCode: ContainerStatus; status?: string }> {
  const url = `${graphBase()}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`;
  const body = await graphRequest<{ status_code: ContainerStatus; status?: string }>(
    url,
    undefined,
    fetchImpl
  );
  return { statusCode: body.status_code, status: body.status };
}

export interface WaitForContainerOptions {
  /** Delay between polls. */
  intervalMs?: number;
  /** Give up after this long. */
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
}

/** Polls until the container is FINISHED, or throws if it errors or times out. */
export async function waitForContainerReady(
  accessToken: string,
  containerId: string,
  options: WaitForContainerOptions = {}
): Promise<void> {
  const intervalMs = options.intervalMs ?? 5_000;
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const started = Date.now();

  for (;;) {
    const { statusCode, status } = await getContainerStatus(
      accessToken,
      containerId,
      options.fetchImpl
    );
    if (statusCode === "FINISHED" || statusCode === "PUBLISHED") return;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new MetaApiError(
        400,
        undefined,
        undefined,
        `Instagram could not process the video (${statusCode}${status ? `: ${status}` : ""})`
      );
    }
    if (Date.now() - started + intervalMs > timeoutMs) {
      throw new MetaApiError(
        408,
        undefined,
        undefined,
        "Timed out waiting for Instagram to process the video"
      );
    }
    await sleep(intervalMs);
  }
}

export async function publishContainer(
  accessToken: string,
  containerId: string,
  fetchImpl: typeof fetch = fetch,
  instagramId?: string
): Promise<string> {
  const igId = instagramId ?? (await resolveInstagramAccountId(accessToken));
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  });
  const body = await graphRequest<{ id: string }>(
    `${graphBase()}/${igId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
    fetchImpl
  );
  return body.id;
}

export async function getMediaPermalink(
  accessToken: string,
  mediaId: string,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  const url = `${graphBase()}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`;
  const body = await graphRequest<{ permalink?: string }>(url, undefined, fetchImpl);
  return body.permalink ?? null;
}

/**
 * Posts a top-level comment on a published IG media item via the official
 * Graph API (`instagram_manage_comments`). Used to seed an automatic CTA
 * first comment right after a scheduled reel goes live.
 */
export async function postFirstComment(
  accessToken: string,
  mediaId: string,
  message: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const params = new URLSearchParams({
    message,
    access_token: accessToken,
  });
  const body = await graphRequest<{ id: string }>(
    `${graphBase()}/${mediaId}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
    fetchImpl
  );
  return body.id;
}
