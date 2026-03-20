import { cn } from "@/lib/utils";
import type { Classification } from "../types";

interface Props {
  value: Classification;
  size?: "sm" | "md";
}

const config: Record<
  Classification,
  { label: string; bg: string; text: string }
> = {
  "Re-buy Candidate": { label: "Re-buy", bg: "#dcfce7", text: "#15803d" },
  Monitor: { label: "Monitor", bg: "#fef3c7", text: "#b45309" },
  "Do Not Re-buy": { label: "Do Not Re-buy", bg: "#fee2e2", text: "#b91c1c" },
};

export function ClassificationBadge({ value, size = "sm" }: Props) {
  const c = config[value];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
      )}
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}
