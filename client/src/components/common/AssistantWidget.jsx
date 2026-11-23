import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, X, Send, Loader2, ExternalLink } from 'lucide-react';
import { publicAPI } from '../../lib/api';

/**
 * Starter questions for a public visitor.
 *
 * Every one of these was run against the live assistant and returns a grounded
 * answer with sources. That check matters: the previous list offered "How can I
 * contact the department?", which retrieves nothing and dead-ends with "I could
 * not find anything about that" — a suggestion the product makes and then
 * cannot honour is worse than no suggestion at all.
 *
 * Re-run them after any significant content change; a question that was
 * answerable can stop being so.
 */
const PUBLIC_SUGGESTIONS = [
  'What programmes does the department offer?',
  'What research areas are covered by the department?',
  'What facilities and labs does the department have?',
  'What are the latest news and announcements?',
  'What achievements have students won recently?',
  'What events are coming up?',
];

/**
 * Starter questions for a signed-in faculty member.
 *
 * Phrased in the first person, because retrieval seeds on the caller's own
 * record when the question is self-referential — and because suggesting
 * anything about another person would offer something the backend will refuse.
 */
const FACULTY_SUGGESTIONS = [
  'What is my research specialization?',
  'What are my publications?',
  'Show my profile details',
  'What programmes does the department offer?',
];

/**
 * An identity for the current session, used only to detect that it changed.
 *
 * The token itself is never parsed or trusted here — the backend derives
 * identity from the verified JWT. This is purely a client-side cache key, so a
 * cheap hash is enough and avoids keeping the raw token in React state.
 */
const sessionKey = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return 'anonymous';
    let hash = 0;
    for (let i = 0; i < token.length; i += 1) {
      hash = (hash * 31 + token.charCodeAt(i)) | 0;
    }
    return `session:${hash}`;
  } catch {
    return 'anonymous';
  }
};

/**
 * Only same-origin site paths are rendered as links.
 *
 * Source URLs come from the backend and are always site-relative, so this
 * never fires in practice. It exists so that a stored value which somehow
 * became `javascript:…` or pointed at another host renders as inert text
 * rather than as a clickable link.
 */
const isSafeSitePath = (url) =>
  typeof url === 'string' && /^\/(?!\/)[\w\-./?=&%#]*$/.test(url);

/**
 * Floating CSE Department AI Assistant.
 *
 * Answers are produced server-side from published website content only; this
 * component never talks to an AI provider directly and holds no API key. It
 * also enforces no access rules — it cannot, and does not try to. What it
 * sends is a question; what comes back has already been scoped to whatever the
 * verified session is allowed to see.
 *
 * Conversation history lives in component state for the active session only,
 * and is discarded when the signed-in account changes.
 */
export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(null);
  const [mode, setMode] = useState(null);
  const [scope, setScope] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [session, setSession] = useState(sessionKey);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const suggestions =
    scope && scope.startsWith('faculty') ? FACULTY_SUGGESTIONS : PUBLIC_SUGGESTIONS;

  // Questions already asked are dropped, so the chips stay useful instead of
  // re-offering something the user can see the answer to further up.
  const asked = new Set(
    messages.filter((m) => m.role === 'user').map((m) => m.text.toLowerCase()),
  );
  const followUps = suggestions.filter((s) => !asked.has(s.toLowerCase())).slice(0, 3);

  // Only after the assistant has spoken, and not while a reply is in flight.
  const showFollowUps =
    messages.length > 0 &&
    !sending &&
    messages[messages.length - 1].role === 'assistant' &&
    followUps.length > 0;

  // Probe once: the widget hides entirely if the endpoint is unreachable.
  useEffect(() => {
    publicAPI
      .assistantStatus()
      .then((res) => {
        setAvailable(true);
        setMode(res.data?.data?.mode || null);
      })
      .catch(() => setAvailable(false));
  }, []);

  /**
   * Discard the conversation when the account changes.
   *
   * Logging out, logging in, or switching accounts must not leave the previous
   * user's questions and answers on screen — a faculty session's replies can
   * contain their own profile and publications, which the next person at that
   * browser is not entitled to read. Polling covers logout from another tab,
   * where no React state change would otherwise fire; `storage` events do not
   * fire in the tab that made the change, so an interval is the reliable
   * signal for both cases.
   */
  useEffect(() => {
    const check = () => {
      const current = sessionKey();
      if (current !== session) {
        setSession(current);
        setMessages([]);
        setInput('');
        setScope(null);
        setOpen(false);
      }
    };

    window.addEventListener('storage', check);
    const timer = setInterval(check, 2000);

    return () => {
      window.removeEventListener('storage', check);
      clearInterval(timer);
    };
  }, [session]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, sending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Escape closes the panel; focus returns to the launcher.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || sending) return;

    setInput('');
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setSending(true);

    try {
      const res = await publicAPI.askAssistant(question, { timeout: 60000 });
      const data = res.data?.data || {};
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: data.answer || 'No answer was returned.',
          sources: data.sources || [],
          mode: data.mode,
          // A refusal is a correct outcome, not an error, and is styled as a
          // neutral notice rather than a failure. A greeting is neither — it
          // is an ordinary reply, so it must not carry the "outside what I can
          // answer" marker.
          refused: data.mode === 'refused',
          retry: question,
        },
      ]);
      if (data.mode) setMode(data.mode);
      if (data.scope) setScope(data.scope);
    } catch (err) {
      const status = err?.response?.status;

      // 401 here means a stale or expired session token, not a server fault.
      // The global interceptor has already cleared it; asking again goes out
      // anonymously and works.
      const text =
        status === 429
          ? 'You have reached the hourly question limit. Please try again later.'
          : status === 401
            ? 'Your session has expired. Your question was not sent — please ask again, or sign in if you need your own records.'
            : 'Sorry — I could not reach the assistant. Please try again, or use the search page.';

      setMessages((m) => [
        ...m,
        { role: 'assistant', text, sources: [], isError: true, retry: question },
      ]);

      if (status === 401) {
        // Drop the faculty badge and the conversation: the session is gone.
        setScope(null);
        setSession(sessionKey());
      }
    } finally {
      setSending(false);
    }
  };

  if (available === false) return null;

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close the department assistant' : 'Open the department assistant'}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[#8B0000] text-white shadow-lg transition hover:bg-[#6d0000] focus:outline-none focus:ring-4 focus:ring-[#8B0000]/30"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="CSE Department AI Assistant"
          className="fixed bottom-24 right-5 z-[60] flex h-[min(34rem,calc(100vh-8rem))] w-[min(26rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        >
          <header className="border-b border-gray-200 bg-[#8B0000] px-4 py-3 text-white">
            <h2 className="text-sm font-semibold">CSE Department AI Assistant</h2>
            <p className="text-[11px] text-white/80">
              Answers from published department content
            </p>

            {/* Tells a signed-in faculty member why answers are narrower than
                the public site. The scope string comes from the server, which
                is also what enforces it. */}
            {scope && scope.startsWith('faculty') && (
              <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium">
                Signed in — answering about your own records only
              </p>
            )}
          </header>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div>
                <p className="mb-3 text-sm text-gray-600">
                  {scope && scope.startsWith('faculty')
                    ? 'Ask about your own profile, research, publications and projects — or about the department generally.'
                    : 'Ask about programmes, faculty, research, facilities, events or achievements.'}
                </p>

                <p
                  id="assistant-starters-label"
                  className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                >
                  Try one of these
                </p>
                <div
                  role="group"
                  aria-labelledby="assistant-starters-label"
                  className="space-y-2"
                >
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 transition hover:border-[#8B0000]/40 hover:bg-[#8B0000]/5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {mode === 'retrieval-only' && (
                  <p className="mt-4 rounded-lg bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900">
                    Written summaries are not enabled on this deployment, so the
                    assistant replies with the matching department pages.
                  </p>
                )}
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={`max-w-[85%] overflow-hidden rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#8B0000] text-white'
                      : m.isError
                        ? 'bg-red-50 text-red-900'
                        : m.refused
                          ? 'border border-amber-200 bg-amber-50 text-amber-900'
                          : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {/* Rendered as text, never as HTML or Markdown. React escapes
                      it, so model output cannot inject markup, and `break-words`
                      stops a long unbroken string from widening the panel. */}
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>

                  {m.refused && (
                    <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-amber-700">
                      Outside what I can answer
                    </p>
                  )}

                  {m.isError && m.retry && (
                    <button
                      type="button"
                      onClick={() => send(m.retry)}
                      className="mt-2 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-[12px] font-medium text-red-800 hover:bg-red-50"
                    >
                      Try again
                    </button>
                  )}

                  {m.sources?.length > 0 && (
                    <div className="mt-3 border-t border-gray-300/60 pt-2">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Sources
                      </p>
                      <ul className="space-y-1">
                        {m.sources.map((s, j) => (
                          <li key={j}>
                            {isSafeSitePath(s.url) ? (
                              <Link
                                to={s.url}
                                onClick={() => setOpen(false)}
                                className="inline-flex items-start gap-1 text-[12px] text-[#8B0000] underline-offset-2 hover:underline"
                              >
                                <span className="tabular-nums">[{s.ref ?? j + 1}]</span>
                                <span className="break-words">{s.title}</span>
                                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                              </Link>
                            ) : (
                              <span className="inline-flex items-start gap-1 text-[12px] text-gray-600">
                                <span className="tabular-nums">[{s.ref ?? j + 1}]</span>
                                <span className="break-words">{s.title}</span>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-gray-100 px-3.5 py-2.5 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking through the website…
                </div>
              </div>
            )}

            {/* Follow-up chips. The starter list above only ever showed on an
                empty conversation, so after the first question the user had no
                idea what else to ask — which matters most right after a refusal,
                when they most need a nudge towards something answerable. */}
            {showFollowUps && (
              <div className="pt-1">
                <p
                  id="assistant-followups-label"
                  className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                >
                  {messages[messages.length - 1].refused
                    ? 'Try asking instead'
                    : 'Ask next'}
                </p>
                <div
                  role="group"
                  aria-labelledby="assistant-followups-label"
                  className="flex flex-wrap gap-1.5"
                >
                  {followUps.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-left text-[12px] leading-snug text-gray-700 transition hover:border-[#8B0000]/50 hover:bg-[#8B0000]/5 hover:text-[#8B0000]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-gray-200 p-3"
          >
            <div className="flex items-end gap-2">
              <label htmlFor="assistant-input" className="sr-only">
                Ask the department assistant a question
              </label>
              <input
                id="assistant-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={500}
                placeholder="Ask a question…"
                className="flex-1 rounded-full border border-gray-300 px-3.5 py-2 text-sm outline-none transition focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/20"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                aria-label="Send question"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8B0000] text-white transition enabled:hover:bg-[#6d0000] disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-gray-400">
              Answers come from published department pages and may be incomplete.
              Verify important details with the department.
            </p>
          </form>
        </div>
      )}
    </>
  );
}
