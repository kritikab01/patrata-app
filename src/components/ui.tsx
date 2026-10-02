import type { ReactNode } from "react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-card border border-cardborder bg-white p-4 text-sm">
      <p className="text-decline font-medium">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1 text-brand font-medium hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 p-4 text-muted text-sm">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
      <h2 className="font-archivo font-700 text-lg leading-tight text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function StatusMarker({ status }: { status: "pass" | "review" | "fail" }) {
  if (status === "pass") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-600">
        <span className="flex h-4 w-4 items-center justify-center bg-ink text-white">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        Pass
      </span>
    );
  }
  if (status === "review") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-600">
        <span className="flex h-4 w-4 items-center justify-center border-[1.5px] border-ink" />
        Review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-600 text-decline">
      <span className="flex h-4 w-4 items-center justify-center text-decline">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </span>
      Fail
    </span>
  );
}
