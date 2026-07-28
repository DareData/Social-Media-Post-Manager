import { CornerUpLeft, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { isCommentUnread, useStore } from "@/lib/store";
import { renderWithMentions } from "@/lib/mentions";
import type { Comment } from "@/lib/types";
import { CommentReactions } from "./CommentReactions";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommentItem({
  comment,
  unreadSince,
  parentAuthorName,
  onReply,
}: {
  comment: Comment;
  unreadSince?: string | null;
  parentAuthorName?: string;
  onReply?: (comment: Comment) => void;
}) {
  const { profiles, currentUser, deleteComment } = useStore();
  const author = profiles.find((p) => p.id === comment.authorId);
  const isUnread = unreadSince !== undefined && isCommentUnread(comment, currentUser.id, unreadSince);
  const isOwn = comment.authorId === currentUser.id;
  const displayName = comment.guestName
    ? `${comment.guestName} (shared link)`
    : isOwn
      ? "You"
      : (author?.fullName ?? "Unknown");

  const handleDelete = () => {
    if (!confirm("Delete this note? This can't be undone.")) return;
    deleteComment(comment.id);
  };

  return (
    <div
      className={cn(
        "group flex gap-2 rounded-lg px-1.5 py-1",
        isOwn && "bg-primary/[0.04] ring-1 ring-primary/10",
      )}
    >
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarFallback className="text-[10px]">{author?.initials ?? "?"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        {parentAuthorName && (
          <div className="mb-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <CornerUpLeft className="size-3" />
            Replying to {parentAuthorName}
          </div>
        )}
        <div className="flex items-baseline gap-2">
          {isUnread && <span className="size-1.5 shrink-0 rounded-full bg-destructive" aria-label="Unread" />}
          <span className="text-sm font-medium">{displayName}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{formatWhen(comment.createdAt)}</span>
          <div className="ml-auto flex items-center gap-1">
            {onReply && (
              <button
                type="button"
                onClick={() => onReply(comment)}
                aria-label="Reply"
                title="Reply"
                className="rounded text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              >
                <CornerUpLeft className="size-3" />
              </button>
            )}
            {isOwn && (
              <button
                type="button"
                onClick={handleDelete}
                aria-label="Delete note"
                title="Delete note"
                className="rounded text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
        {/* overflow-wrap:anywhere, not break-words (overflow-wrap:break-word) —
            break-word doesn't count toward a flex/grid ancestor's min-content
            size, so a long unbroken string (e.g. a UTM link) would force the
            dialog itself to grow before ever wrapping. anywhere does count,
            so the dialog stays put and the text wraps inside it instead. */}
        <p className="text-sm text-foreground/90 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {renderWithMentions(comment.body, profiles)}
        </p>
        <CommentReactions commentId={comment.id} />
      </div>
    </div>
  );
}
