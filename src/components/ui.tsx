import { Component, type ReactNode, type ErrorInfo } from "react";

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
          type="button"
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

export class CardErrorBoundary extends Component<
  { children: ReactNode; fallbackMessage?: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallbackMessage?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Result card error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-card border border-cardborder bg-white p-5 text-sm">
          <p className="text-decline font-medium">
            {this.props.fallbackMessage || "Couldn't load this part. Try again"}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-2 inline-flex items-center gap-1 text-brand font-medium hover:underline"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function StatusMarker({ status }: { status: "pass" | "review" | "fail" | string }) {
  const norm = (status || "").toLowerCase();
  if (norm === "pass") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-600 text-ink">
        <span className="inline-block h-3.5 w-3.5 bg-ink shrink-0" aria-hidden="true" />
        Pass
      </span>
    );
  }
  if (norm === "review" || norm === "refer") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-600 text-[#B45309]">
        <span
          className="inline-block h-3.5 w-3.5 border-2 border-[#B45309] bg-transparent shrink-0"
          aria-hidden="true"
        />
        Review
      </span>
    );
  }
  if (norm === "fail" || norm === "decline") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-600 text-[#B42318]">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#B42318"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
        Fail
      </span>
    );
  }
  return <span className="text-sm font-600 text-muted">{status || "—"}</span>;
}
