import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createReelContainer,
  publishContainer,
  waitForContainerReady,
} from "@/lib/meta/publish";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let tokenCounter = 0;
function freshToken() {
  tokenCounter += 1;
  return `test-token-${tokenCounter}`;
}

describe("reel publishing", () => {
  beforeEach(() => {
    vi.stubEnv("META_GRAPH_API_VERSION", "v26.0");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("creates a REELS container from a signed video url", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.includes("/me/assigned_instagram_accounts")) {
          return json({ data: [{ id: "17841400000000001" }] });
        }
        return json({ id: "container-1" });
      })
    );

    const id = await createReelContainer({
      accessToken: freshToken(),
      videoUrl: "https://example.r2.cloudflarestorage.com/R07.mp4?X-Amz-Signature=abc",
      caption: "Comment LINK",
    });

    expect(id).toBe("container-1");
    const create = calls.find((c) => c.url.endsWith("/17841400000000001/media"));
    expect(create).toBeDefined();
    const body = new URLSearchParams(String(create?.init?.body));
    expect(body.get("media_type")).toBe("REELS");
    expect(body.get("video_url")).toContain("X-Amz-Signature=abc");
    expect(body.get("caption")).toBe("Comment LINK");
  });

  it("returns the media id on publish", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/me/assigned_instagram_accounts")) {
          return json({ data: [{ id: "17841400000000002" }] });
        }
        return json({ id: "media-99" });
      })
    );
    expect(await publishContainer(freshToken(), "container-1")).toBe("media-99");
  });

  it("waits until the container is FINISHED", async () => {
    const statuses = ["IN_PROGRESS", "IN_PROGRESS", "FINISHED"];
    const fetchImpl = vi.fn(async () => json({ status_code: statuses.shift() }));
    const sleep = vi.fn(async () => undefined);
    await waitForContainerReady("t", "c1", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
      intervalMs: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("throws when Instagram reports ERROR", async () => {
    const fetchImpl = vi.fn(async () => json({ status_code: "ERROR", status: "bad codec" }));
    await expect(
      waitForContainerReady("t", "c1", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => undefined,
        intervalMs: 1,
      })
    ).rejects.toThrow(/could not process/i);
  });

  it("times out instead of polling forever", async () => {
    const fetchImpl = vi.fn(async () => json({ status_code: "IN_PROGRESS" }));
    await expect(
      waitForContainerReady("t", "c1", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => undefined,
        intervalMs: 10,
        timeoutMs: 5,
      })
    ).rejects.toThrow(/timed out/i);
  });

  it("surfaces Graph API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/me/assigned_instagram_accounts")) {
          return json({ data: [{ id: "17841400000000003" }] });
        }
        return json({ error: { message: "Permission denied", code: 10 } }, 400);
      })
    );
    await expect(publishContainer(freshToken(), "c")).rejects.toThrow("Permission denied");
  });
});
