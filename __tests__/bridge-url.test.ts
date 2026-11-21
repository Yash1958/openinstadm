import { describe, expect, it } from "vitest";
import {
  buildBridgeUrl,
  buildDeliveryUrl,
  buildTrackedUrl,
  renderMessageWithTracking,
  renderMessageWithoutLink,
} from "@/lib/tracking/message";

describe("bridge page URLs and DM rendering", () => {
  it("routes bridge-enabled links to /p/<slug> and standard links to /r/<slug>", () => {
    expect(buildTrackedUrl("abc123", "https://openinstadm-swart.vercel.app")).toBe(
      "https://openinstadm-swart.vercel.app/r/abc123"
    );
    expect(buildBridgeUrl("abc123", "https://openinstadm-swart.vercel.app")).toBe(
      "https://openinstadm-swart.vercel.app/p/abc123"
    );
    expect(
      buildDeliveryUrl(
        { slug: "abc123", bridgeEnabled: true },
        "https://openinstadm-swart.vercel.app"
      )
    ).toBe("https://openinstadm-swart.vercel.app/p/abc123");
    expect(
      buildDeliveryUrl(
        { slug: "abc123", bridgeEnabled: false },
        "https://openinstadm-swart.vercel.app"
      )
    ).toBe("https://openinstadm-swart.vercel.app/r/abc123");
  });

  it("renders inline DM with /p/ URL when bridgeEnabled is true", () => {
    const out = renderMessageWithTracking({
      message: "Hey {username}! Link: {link}",
      commenterName: "riya",
      trackedLinks: [
        {
          slug: "xyz789",
          destinationUrl: "https://amzn.to/example",
          bridgeEnabled: true,
        },
      ],
      baseUrl: "https://openinstadm-swart.vercel.app",
    });
    expect(out).toBe("Hey riya! Link: https://openinstadm-swart.vercel.app/p/xyz789");
  });

  it("preserves paragraph breaks when stripping {link} for button templates", () => {
    const out = renderMessageWithoutLink({
      message:
        "Hey {username}! Tap below for the product link.\n{link}\nAffiliate link: I may earn a small commission.",
      commenterName: "riya",
    });
    expect(out).toBe(
      "Hey riya! Tap below for the product link.\nAffiliate link: I may earn a small commission."
    );
  });
});
