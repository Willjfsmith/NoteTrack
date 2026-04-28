export type RiskStatus = "open" | "mitigating" | "closed";

export type RiskRow = {
  entry_id: string;
  body_md: string;
  occurred_at: string;
  probability: number;
  impact: number;
  status: RiskStatus;
  owner: { id: string; short_id: string; name: string; initials: string; color: string | null } | null;
  source_item_ref: string | null;
};

export function scoreColor(score: number): "green" | "yellow" | "orange" | "red" {
  if (score >= 15) return "red";
  if (score >= 10) return "orange";
  if (score >= 5) return "yellow";
  return "green";
}
