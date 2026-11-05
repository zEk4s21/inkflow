import { cn } from "@/lib/cn";

export function InstagramStats({
  likes,
  comments,
  className,
}: {
  likes: number | null;
  comments: number | null;
  className?: string;
}) {
  if (likes === null && comments === null) return null;
  return (
    <p className={cn("flex items-center gap-4 tabular-nums", className)}>
      {likes !== null && (
        <span>
          <span aria-hidden>♥</span> {likes.toLocaleString("es-AR")}
          <span className="sr-only"> me gusta</span>
        </span>
      )}
      {comments !== null && (
        <span>
          <span aria-hidden>💬</span> {comments.toLocaleString("es-AR")}
          <span className="sr-only"> comentarios</span>
        </span>
      )}
    </p>
  );
}
