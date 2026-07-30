const TONES = {
  error: "border-danger/30 bg-danger-soft text-danger",
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  info: "border-border bg-brand-soft text-brand",
} as const;

export function Alert({
  tone = "error",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-tile border px-3 py-2.5 text-sm ${TONES[tone]}`}
    >
      {children}
    </p>
  );
}
