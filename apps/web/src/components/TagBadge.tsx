export const TAG_COLORS = {
  slate: "#64748b",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  green: "#22c55e",
  teal: "#14b8a6",
  blue: "#3b82f6",
  violet: "#8b5cf6",
  pink: "#ec4899",
} as const;

export type TagColor = keyof typeof TAG_COLORS;
export const TAG_COLOR_KEYS = Object.keys(TAG_COLORS) as TagColor[];

type TagLike = { name: string; color?: string };

export function TagColorDot({ color, size = "sm" }: { color?: string; size?: "sm" | "md" }) {
  const hex = color ? (TAG_COLORS[color as TagColor] ?? TAG_COLORS.slate) : TAG_COLORS.slate;
  const cls = size === "md" ? "size-3 rounded-full shrink-0" : "size-2 rounded-full shrink-0";
  return <span className={cls} style={{ backgroundColor: hex }} aria-hidden="true" />;
}

export function TagBadge({ tag }: { tag: TagLike }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-input bg-background px-1.5 py-0.5 text-xs font-medium text-foreground">
      <TagColorDot color={tag.color} />
      {tag.name}
    </span>
  );
}
