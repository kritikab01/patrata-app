import { useState, useEffect, useRef } from "react";
import { Icon } from "./viz";

export function DeskPinModal({
  isOpen,
  initialError,
  onSuccess,
  onCancel,
}: {
  isOpen: boolean;
  initialError?: string | null;
  onSuccess: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(initialError || null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError(initialError || null);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen, initialError]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = pin.trim();
    if (clean.length !== 4) {
      setError("Please enter a 4-digit PIN");
      return;
    }
    setError(null);
    onSuccess(clean);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-[18px] border border-cardborder bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-cardborder pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-btn bg-[#EEF3FF] text-[#1E4FD8]">
              <Icon name="dashboard" size={18} color="#1E4FD8" />
            </div>
            <div>
              <h3 className="font-archivo font-bold text-base text-ink">Lender Desk Access</h3>
              <p className="text-[11px] text-muted">PIN required for review & desk tools</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-btn text-muted hover:text-ink hover:bg-page transition-colors"
          >
            <Icon name="cross" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="desk-pin-input" className="block text-xs font-bold text-ink mb-1">
              Enter 4-digit desk PIN
            </label>
            <input
              id="desk-pin-input"
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                setPin(val);
                if (error) setError(null);
              }}
              placeholder="••••"
              className="w-full text-center tracking-[0.5em] text-xl font-archivo font-bold h-12 rounded-btn border border-cardborder px-4 focus:border-[#1E4FD8] focus:ring-1 focus:ring-[#1E4FD8] outline-none"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-xs font-bold text-[#B42318] text-center">
                {error}
              </p>
            )}
            <p className="mt-2 text-[11px] text-muted text-center">
              Stored only in this browser session.
            </p>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-10 rounded-btn border border-cardborder bg-white text-xs font-archivo font-bold text-muted hover:text-ink hover:bg-page transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pin.length !== 4}
              className="flex-1 h-10 rounded-btn bg-[#1E4FD8] text-white text-xs font-archivo font-bold hover:bg-[#1A44BD] disabled:opacity-40 transition-colors shadow-sm"
            >
              Unlock desk
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
