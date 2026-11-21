"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReelFile {
  key: string;
  size: number;
}

interface ScheduledReelRow {
  id: string;
  name: string;
  r2Key: string;
  scheduledAt: string;
  status: "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED";
  keyword: string;
  destinationUrl: string;
  permalink: string | null;
  error: string | null;
}

const DEFAULT_DM =
  "Hey {username}! Here is the link you asked for: {link}\nAffiliate link: I may earn a small commission at no extra cost to you.";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SchedulerPage() {
  const [files, setFiles] = useState<ReelFile[]>([]);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [reels, setReels] = useState<ScheduledReelRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [r2Key, setR2Key] = useState("");
  const [name, setName] = useState("");
  const [caption, setCaption] = useState("");
  const [when, setWhen] = useState("");
  const [keyword, setKeyword] = useState("LINK");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [dmMessage, setDmMessage] = useState(DEFAULT_DM);

  const load = useCallback(async () => {
    const [list, bucket] = await Promise.all([
      fetch("/api/scheduled-reels").then((r) => r.json()),
      fetch("/api/scheduled-reels/files").then((r) => r.json()),
    ]);
    if (list.success) setReels(list.data);
    if (bucket.success) {
      setFiles(bucket.data);
      setFilesError(null);
    } else {
      setFilesError(bucket.error ?? "Could not read the video bucket");
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount; setState happens after the awaited requests.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/scheduled-reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          r2Key,
          caption,
          scheduledAt: new Date(when).toISOString(),
          keyword,
          dmMessage,
          destinationUrl,
        }),
      });
      const json = await response.json();
      if (!json.success) {
        setMessage(json.error ?? "Could not schedule the reel");
      } else {
        setMessage("Scheduled.");
        setR2Key("");
        setName("");
        setCaption("");
        setWhen("");
        setDestinationUrl("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id: string) {
    const response = await fetch(`/api/scheduled-reels?id=${id}`, { method: "DELETE" });
    const json = await response.json();
    if (!json.success) setMessage(json.error ?? "Could not cancel");
    await load();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Scheduled reels</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a video from the private bucket, set the time, and the worker publishes it
          and creates its comment-to-DM campaign on the new post.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-border p-4">
        <div className="space-y-2">
          <Label htmlFor="r2Key">Video in the bucket</Label>
          <select
            id="r2Key"
            required
            value={r2Key}
            onChange={(e) => setR2Key(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Select a video…</option>
            {files.map((f) => (
              <option key={f.key} value={f.key}>
                {f.key} ({(f.size / 1_000_000).toFixed(1)} MB)
              </option>
            ))}
          </select>
          {filesError ? (
            <p className="text-xs text-destructive">{filesError}</p>
          ) : files.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              The bucket has no .mp4 files yet. Upload them in Cloudflare R2 first.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="when">Post at (your local time)</Label>
            <Input
              id="when"
              type="datetime-local"
              required
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="caption">Caption</Label>
          <Textarea
            id="caption"
            required
            rows={7}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="keyword">Trigger word</Label>
            <Input
              id="keyword"
              required
              value={keyword}
              onChange={(e) => setKeyword(e.target.value.replace(/\s/g, ""))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Affiliate link</Label>
            <Input
              id="url"
              type="url"
              required
              placeholder="https://link.amazon/…"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dm">DM message ({"{link}"} and {"{username}"} are filled in)</Label>
          <Textarea
            id="dm"
            required
            rows={3}
            value={dmMessage}
            onChange={(e) => setDmMessage(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Scheduling…" : "Schedule reel"}
          </Button>
          {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Queue</h2>
        {reels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
        ) : (
          reels.map((reel) => (
            <div
              key={reel.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="font-medium">{reel.name}</div>
                <div className="text-xs text-muted-foreground">
                  {reel.r2Key} · {formatWhen(reel.scheduledAt)} · word {reel.keyword}
                </div>
                {reel.error ? <div className="text-xs text-destructive">{reel.error}</div> : null}
                {reel.permalink ? (
                  <a
                    href={reel.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline"
                  >
                    View on Instagram
                  </a>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                  {reel.status.toLowerCase()}
                </span>
                {reel.status === "SCHEDULED" ? (
                  <Button variant="outline" size="sm" onClick={() => void cancel(reel.id)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
