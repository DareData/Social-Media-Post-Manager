"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const GUEST_NAME_KEY = "sharedLinkGuestName";

interface PublicComment {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// A deliberately simple comment thread for the public post link — flat,
// newest-first, no replies/reactions/@mentions. Whoever's commenting can
// type a name (remembered in this browser for next time) so the team can
// tell who said what, even though every comment made here is attributed in
// the database to the same "shared link" pseudo-profile.
export function PublicCommentSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/public/posts/${postId}/comments`);
    if (res.ok) setComments((await res.json()).comments);
    setLoading(false);
  };

  useEffect(() => {
    // Reading a saved preference on mount — legitimate sync-with-storage case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(window.localStorage.getItem(GUEST_NAME_KEY) ?? "");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    if (name.trim()) window.localStorage.setItem(GUEST_NAME_KEY, name.trim());

    const res = await fetch(`/api/public/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: trimmed, guestName: name.trim() || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error("Couldn't post your comment — try again.");
      return;
    }
    setBody("");
    load();
  };

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h3>

      {!loading && comments.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-muted/40 p-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium">{c.authorName}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{formatWhen(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-foreground/90">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="max-w-60" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Leave a comment…" rows={2} />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={!body.trim() || submitting}>
            {submitting ? "Posting…" : "Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
