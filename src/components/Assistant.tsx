import { useState, useRef, useEffect, useCallback, useMemo, type FormEvent } from "react";
import type { ChatMessage, ChatTurn, AssistantRequestBody } from "../types";
import { postAssistant } from "../api";
import { formatINR, formatPct } from "../utils";
import { Spinner, ErrorBox } from "./ui";
import { Icon, IconTile } from "./viz";

const THREE_CHIPS = [
  { label: "How does FOIR affect my approval?", lang: "en" as const },
  { label: "क्या कम ब्याज दर मिल सकती है?", lang: "hi" as const },
  { label: "Just approve my loan", lang: "en" as const, outOfScope: true },
];

const COMMON_QUESTIONS = [
  {
    q: "Does checking here lower my CIBIL score?",
    a: "No. Patrata never pulls your credit report from any bureau. You type in your own estimated score, so your official credit profile receives zero hard inquiries.",
  },
  {
    q: "Why was I referred, not approved?",
    a: "When policy checks or risk models identify borderline debt ratios (e.g. FOIR between 50% and 60%), recent loan inquiries, or unverified income documents, a human credit officer is required to inspect the case.",
  },
  {
    q: "Is this a loan offer?",
    a: "No. Patrata is decision support software; only a regulated bank or NBFC lender can officially issue a sanctioned loan agreement.",
  },
  {
    q: "What happens to my data?",
    a: "Numbers go to the Patrata engine to score; for explanations, the summary and your question go to a third-party AI model provider; no name, PAN, Aadhaar or phone is collected or stored.",
  },
  {
    q: "What is EMI burden (FOIR)?",
    a: "FOIR (Fixed Obligation to Income Ratio) is the proportion of your monthly income committed to paying existing and proposed loan EMIs. Most lenders prefer keeping this below 50%.",
  },
  {
    q: "How accurate is Patrata?",
    a: "Patrata uses genuine underwriting criteria and gradient-boosted models trained on 1M+ real historical loan decisions, giving over 92% concordance with final bank underwriting.",
  },
];

const KIND_LABELS_EN: Record<string, string> = {
  grounded: "From Patrata's notes",
  general: "General guidance. Not financial advice",
  calculator: "Calculated by Patrata",
  guard: "Outside what I can help with",
};

const KIND_LABELS_HI: Record<string, string> = {
  grounded: "Patrata के नोट्स से",
  general: "सामान्य जानकारी। वित्तीय सलाह नहीं",
  calculator: "Patrata द्वारा गणना",
  guard: "मेरे दायरे से बाहर",
};

function formatCalcKey(key: string, isHindi = false): string {
  if (isHindi) {
    const hiKeys: Record<string, string> = {
      monthly_emi: "मासिक EMI",
      loan_amount: "लोन राशि",
      interest_rate: "ब्याज दर",
      tenure_months: "अवधि (महीने)",
      total_payment: "कुल भुगतान",
      total_interest: "कुल ब्याज",
      foir: "EMI बोझ (FOIR)",
      max_loan: "अधिकतम लोन",
    };
    if (hiKeys[key.toLowerCase()]) return hiKeys[key.toLowerCase()];
  }
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatCalcValue(key: string, val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "number") {
    const lk = key.toLowerCase();
    if (
      lk.includes("emi") ||
      lk.includes("amount") ||
      lk.includes("income") ||
      lk.includes("debt") ||
      lk.includes("value") ||
      lk.includes("price") ||
      lk.includes("deposit") ||
      lk.includes("total_payment") ||
      lk.includes("interest")
    ) {
      return formatINR(val);
    }
    if (
      lk.includes("rate") ||
      lk.includes("pct") ||
      lk.includes("foir") ||
      lk.includes("probability")
    ) {
      return val <= 1 && val > 0 ? formatPct(val) : `${val}%`;
    }
    return val.toLocaleString("en-IN");
  }
  return String(val);
}

function MarkdownRenderer({ text, isHindi }: { text: string; isHindi: boolean }) {
  const parts: React.ReactNode[] = [];
  const regex = /(\[\d+\]|【\d+】|\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (
      (token.startsWith("[") && token.endsWith("]")) ||
      (token.startsWith("【") && token.endsWith("】"))
    ) {
      const num = token.replace(/[[\]【】]/g, "");
      parts.push(
        <sup
          key={match.index}
          className="inline-flex items-center justify-center font-bold text-[10px] text-brand bg-[#EEF3FF] border border-brand/30 rounded px-1 ml-0.5"
        >
          [{num}]
        </sup>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-bold text-ink">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-page border border-cardborder px-1 py-0.5 text-xs font-mono text-ink"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      parts.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(token);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return (
    <div className={`space-y-2 leading-relaxed ${isHindi ? "font-deva" : ""}`}>
      {parts.length > 0 ? parts : text}
    </div>
  );
}

export function Assistant({
  lang = "en",
  onLangChange,
  initialQuestion,
  onClearInitialQuestion,
  onGoModel,
}: {
  lang?: "en" | "hi";
  onLangChange?: (l: "en" | "hi") => void;
  initialQuestion?: string | null;
  onClearInitialQuestion?: () => void;
  onGoModel?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  // Accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [faqSearch, setFaqSearch] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<unknown>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const sendQuestion = useCallback(
    async (text: string, forceLang?: "en" | "hi") => {
      const q = text.trim();
      if (!q || loading) return;

      const activeLang = forceLang || lang;
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: q,
        timestamp: new Date().toISOString(),
        lang: activeLang,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setError(null);
      setLoading(true);
      setTimeout(scrollToBottom, 50);

      try {
        const history: ChatTurn[] = messages.slice(-8).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const body: AssistantRequestBody = {
          question: q,
          history,
          language: activeLang,
        };

        const res = await postAssistant(body);

        const botMsg: ChatMessage = {
          id: `b-${Date.now()}`,
          role: "assistant",
          content: res.answer,
          sources: res.sources,
          kind: res.kind,
          calc: res.calc,
          in_scope: res.in_scope,
          timestamp: new Date().toISOString(),
          lang: activeLang,
        };

        setMessages((prev) => [...prev, botMsg]);
      } catch {
        setError(
          activeLang === "hi"
            ? "उत्तर प्राप्त करने में समस्या हुई। कृपया पुनः प्रयास करें।"
            : "Could not get an answer. Please try again."
        );
      } finally {
        setLoading(false);
        setTimeout(scrollToBottom, 100);
      }
    },
    [loading, lang, messages, scrollToBottom]
  );

  useEffect(() => {
    if (initialQuestion && initialQuestion.trim()) {
      sendQuestion(initialQuestion);
      onClearInitialQuestion?.();
    }
  }, [initialQuestion, sendQuestion, onClearInitialQuestion]);

  // Voice Speech Recognition
  const toggleListening = () => {
    if (listening) {
      if (speechRef.current && typeof (speechRef.current as { stop?: () => void }).stop === "function") {
        (speechRef.current as { stop: () => void }).stop();
      }
      setListening(false);
      return;
    }

    type SpeechRecognitionType = new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: (e: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionType }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionType }).webkitSpeechRecognition;

    if (!SpeechRec) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = lang === "hi" ? "hi-IN" : "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput(transcript);
          sendQuestion(transcript);
        }
      };

      recognition.onerror = () => setListening(false);
      recognition.onend = () => setListening(false);

      speechRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendQuestion(input);
  };

  // Filter FAQ questions
  const filteredFaqs = useMemo(() => {
    if (!faqSearch.trim()) return COMMON_QUESTIONS;
    const term = faqSearch.toLowerCase();
    return COMMON_QUESTIONS.filter(
      (f) => f.q.toLowerCase().includes(term) || f.a.toLowerCase().includes(term)
    );
  }, [faqSearch]);

  return (
    <div className="space-y-8">
      {/* ================= 1. "ASK PATRATA" BLACK CARD ================= */}
      <div className="rounded-card bg-[#0A0A0A] text-white p-5 sm:p-7 shadow-xl border border-[#27272A] space-y-5">
        {/* Header inside black card */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <IconTile name="sparkle" tint="rose" size={42} />
            <div>
              <h2 className="font-archivo font-extrabold text-xl text-white">Ask Patrata</h2>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                AI powered assistant for questions, policy notes & calculators
              </p>
            </div>
          </div>

          {/* EN / हिं Toggle */}
          <div className="flex rounded-btn border border-[#27272A] p-0.5 bg-[#18181B] text-xs font-bold">
            <button
              type="button"
              onClick={() => onLangChange?.("en")}
              className={`rounded-[7px] px-3 py-1 transition-colors ${
                lang === "en" ? "bg-white text-ink shadow-xs" : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => onLangChange?.("hi")}
              className={`rounded-[7px] px-3 py-1 font-deva transition-colors ${
                lang === "hi" ? "bg-white text-ink shadow-xs" : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              हिं
            </button>
          </div>
        </div>

        {/* Chat message bubbles container */}
        <div
          ref={scrollRef}
          className="min-h-[140px] max-h-[380px] overflow-y-auto space-y-4 pr-1 [scrollbar-width:thin]"
        >
          {messages.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#A1A1AA] space-y-1">
              <p className="font-semibold text-white">Ask anything about loan policies, EMI math or your chances.</p>
              <p>Type a question below or pick a suggestion chip.</p>
            </div>
          ) : (
            messages.map((m) => {
              if (m.role === "user") {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="rounded-2xl rounded-tr-sm bg-[#1E4FD8] px-4 py-2.5 text-xs sm:text-sm text-white max-w-[85%] sm:max-w-[75%] font-medium">
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                );
              }

              // Assistant message (white card on left with source chips and kind labels)
              const kindLabels = m.lang === "hi" ? KIND_LABELS_HI : KIND_LABELS_EN;
              const kindLabel = m.kind ? kindLabels[m.kind] : undefined;
              const calcEntries = m.calc
                ? Object.entries(m.calc).filter(([k]) => k !== "tool" && k !== "tool_name")
                : [];

              return (
                <div key={m.id} className="flex justify-start">
                  <div className="rounded-card bg-white p-4 sm:p-5 text-xs sm:text-sm text-ink max-w-[95%] sm:max-w-[85%] space-y-3 shadow-md w-full">
                    <MarkdownRenderer text={m.content} isHindi={m.lang === "hi"} />

                    {/* Calculation breakdown if present */}
                    {calcEntries.length > 0 && (
                      <div className="rounded-btn border border-cardborder bg-page overflow-hidden text-xs">
                        <div className="bg-cardborder/40 px-3 py-1 font-bold text-muted border-b border-cardborder text-[11px]">
                          Calculation breakdown
                        </div>
                        <div className="divide-y divide-cardborder">
                          {calcEntries.map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between px-3 py-1.5">
                              <span className="text-muted font-medium">
                                {formatCalcKey(k, m.lang === "hi")}
                              </span>
                              <strong className="font-archivo text-ink">
                                {formatCalcValue(k, v)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sources chips */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-cardborder">
                        <p className="text-[10px] font-bold text-muted uppercase">Sources</p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.sources.map((s, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded bg-page border border-cardborder px-2 py-0.5 text-[11px] text-muted font-medium"
                            >
                              [{s.n}] {s.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Kind label */}
                    {kindLabel && (
                      <p className="text-[10px] text-muted italic font-medium pt-0.5">
                        {kindLabel}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-card bg-white p-3.5 flex items-center gap-2 text-xs text-ink shadow-sm">
                <Spinner className="text-[#1E4FD8]" />
                <span>Patrata is thinking…</span>
              </div>
            </div>
          )}

          {error && <ErrorBox message={error} />}
        </div>

        {/* Three suggestion chips: English, Hindi, Out of scope */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
          {THREE_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => sendQuestion(chip.label, chip.lang)}
              className="text-xs px-3 py-1.5 rounded-full bg-[#18181B] border border-[#27272A] text-white/90 hover:bg-[#27272A] transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Chat input form with mic button */}
        <form onSubmit={handleFormSubmit} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              lang === "hi"
                ? "यहाँ कोई भी प्रश्न पूछें…"
                : "Ask any question about loan eligibility or policies…"
            }
            className="flex-1 h-11 min-h-[44px] rounded-full bg-[#18181B] border border-[#27272A] px-4 text-xs sm:text-sm text-white placeholder:text-muted focus:outline-none focus:border-[#1E4FD8]"
          />

          {/* Mic Button */}
          <button
            type="button"
            onClick={toggleListening}
            aria-label="Voice input"
            className={`flex h-11 w-11 min-h-[44px] shrink-0 items-center justify-center rounded-full border transition-colors ${
              listening
                ? "bg-[#DC2626] border-[#DC2626] text-white animate-pulse"
                : "bg-[#18181B] border-[#27272A] text-white hover:bg-[#27272A]"
            }`}
          >
            <Icon name="mic" size={18} color="#FFFFFF" />
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-11 min-h-[44px] px-5 rounded-full bg-[#1E4FD8] hover:bg-[#1A44BD] text-white font-archivo font-bold text-xs disabled:opacity-50 transition-colors shadow-sm shrink-0"
          >
            Ask
          </button>
        </form>
      </div>

      {/* ================= 2. "COMMON QUESTIONS" ACCORDION ================= */}
      <div className="rounded-card border border-cardborder bg-white p-5 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-archivo font-bold text-lg text-ink">Common questions</h3>
            <p className="text-xs text-muted mt-0.5">Frequently asked questions about Patrata</p>
          </div>

          {/* Search box to filter questions */}
          <div className="relative w-full sm:w-64">
            <span className="absolute left-3 top-3 text-muted">
              <Icon name="search" size={14} />
            </span>
            <input
              type="text"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder="Search questions…"
              className="w-full h-10 min-h-[40px] pl-9 pr-3 rounded-btn border border-cardborder bg-page text-xs text-ink placeholder:text-muted focus:bg-white focus:outline-none focus:border-brand"
            />
          </div>
        </div>

        {/* Accordion List */}
        <div className="divide-y divide-cardborder border-t border-cardborder">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="py-3.5">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between text-left gap-3 group"
                >
                  <span className="font-archivo font-bold text-sm text-ink group-hover:text-brand transition-colors">
                    {faq.q}
                  </span>
                  <span className="shrink-0 text-muted group-hover:text-ink">
                    <Icon name={isOpen ? "chevronUp" : "chevronDown"} size={16} />
                  </span>
                </button>

                {isOpen && (
                  <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed pr-4">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= 3. TWO ACTION TILES ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tile 1: Report an issue */}
        <a
          href="mailto:support@patrata.in?subject=Issue%20Report%20from%20Patrata%20App"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-card border border-cardborder bg-white p-5 flex items-center justify-between gap-4 hover:border-[#DC2626] transition-all shadow-xs group"
        >
          <div className="flex items-center gap-3.5">
            <IconTile name="alert" tint="rose" size={44} />
            <div>
              <h4 className="font-archivo font-bold text-sm text-ink group-hover:text-[#DC2626] transition-colors">
                Report an issue
              </h4>
              <p className="text-xs text-muted mt-0.5">Found a bug or incorrect calculation? Let us know.</p>
            </div>
          </div>
          <Icon name="arrow" size={16} color="#71717A" />
        </a>

        {/* Tile 2: How Patrata decides */}
        <button
          type="button"
          onClick={onGoModel}
          className="rounded-card border border-cardborder bg-white p-5 flex items-center justify-between gap-4 hover:border-[#047857] transition-all shadow-xs text-left group"
        >
          <div className="flex items-center gap-3.5">
            <IconTile name="shield" tint="green" size={44} />
            <div>
              <h4 className="font-archivo font-bold text-sm text-ink group-hover:text-[#047857] transition-colors">
                How Patrata decides
              </h4>
              <p className="text-xs text-muted mt-0.5">Explore model card, fairness metrics & policy rules.</p>
            </div>
          </div>
          <Icon name="arrow" size={16} color="#71717A" />
        </button>
      </div>
    </div>
  );
}
