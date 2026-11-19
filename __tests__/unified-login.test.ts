import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthorizationUrl, exchangeCodeForToken } from "../lib/meta/oauth";
import { resolveInstagramAccountId, getUserInfo, getUserMedia } from "../lib/meta/client";

describe("Unified Login", () => {
  beforeEach(() => {
    vi.stubEnv("META_APP_ID", "app123");
    vi.stubEnv("META_LOGIN_CONFIG_ID", "cfg456");
    vi.stubEnv("FACEBOOK_APP_SECRET", "shh");
    vi.stubEnv("META_GRAPH_API_VERSION", "v26.0");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("getAuthorizationUrl returns correct URL", () => {
    const url = getAuthorizationUrl("https://example.com/cb", "state1");
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe("https://www.facebook.com/v26.0/dialog/oauth");
    expect(parsed.searchParams.get("client_id")).toBe("app123");
    expect(parsed.searchParams.get("config_id")).toBe("cfg456");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://example.com/cb");
    expect(parsed.searchParams.get("state")).toBe("state1");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("override_default_response_type")).toBe("true");
    expect(parsed.searchParams.has("scope")).toBe(false);
  });

  it("exchangeCodeForToken resolves with token and expiration", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }))
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await exchangeCodeForToken("code1", "https://example.com/cb");

    expect(result).toEqual({ accessToken: "tok", expiresIn: 3600 });
    const fetchedUrl = mockFetch.mock.calls[0][0] as string;
    expect(fetchedUrl.startsWith("https://graph.facebook.com/v26.0/oauth/access_token")).toBe(true);
    expect(fetchedUrl).toContain("client_secret=shh");
    expect(fetchedUrl).toContain("code=code1");
  });

  it("exchangeCodeForToken resolves with null expiresIn when missing", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok" }))
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await exchangeCodeForToken("code1", "https://example.com/cb");

    expect(result).toEqual({ accessToken: "tok", expiresIn: null });
  });

  it("exchangeCodeForToken rejects on 400 status", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad code" } }), { status: 400 })
    );
    vi.stubGlobal("fetch", mockFetch);

    await expect(exchangeCodeForToken("code1", "https://example.com/cb")).rejects.toThrow(
      /Token exchange failed.*bad code/
    );
  });

  it("resolveInstagramAccountId resolves and caches", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "17841" }] }))
    );
    vi.stubGlobal("fetch", mockFetch);

    const token = "unique-token-1";
    const result = await resolveInstagramAccountId(token);
    expect(result).toBe("17841");

    const firstUrl = mockFetch.mock.calls[0][0] as string;
    expect(firstUrl.startsWith("https://graph.facebook.com/v26.0/me/assigned_instagram_accounts")).toBe(true);

    const secondResult = await resolveInstagramAccountId(token);
    expect(secondResult).toBe("17841");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("resolveInstagramAccountId rejects when no account found", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }))
    );
    vi.stubGlobal("fetch", mockFetch);

    const token = "unique-token-2";
    await expect(resolveInstagramAccountId(token)).rejects.toThrow(/No Instagram account/);
  });

  it("getUserMedia resolves media list", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "17842" }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "m1" }] })));
    vi.stubGlobal("fetch", mockFetch);

    const result = await getUserMedia("tokenB", 5);

    expect(result).toEqual([{ id: "m1" }]);
    const secondUrl = mockFetch.mock.calls[1][0] as string;
    expect(secondUrl.startsWith("https://graph.facebook.com/v26.0/17842/media")).toBe(true);
  });
});
