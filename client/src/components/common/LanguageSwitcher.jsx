import { useEffect, useRef, useState } from 'react';
import { Globe, ChevronDown, Check, Loader2 } from 'lucide-react';

import {
  LANGUAGE_GROUPS,
  SOURCE_LANGUAGE,
  findLanguage,
  readActiveLanguage,
} from '../../lib/languages';

/**
 * Language switcher for the site header.
 *
 * Replaces the previous "English | हिन्दी" pair of text links, which had three
 * problems beyond offering only two languages: it gave no indication of which
 * language was currently active, it did not survive a page reload in the UI
 * (the page stayed translated but the control looked untouched), and when the
 * Google Translate script had not finished loading it logged to the console and
 * did nothing visible — the user clicked and the page simply ignored them.
 *
 * Translation itself is still Google's widget. This component only drives the
 * hidden `.goog-te-combo` select that the widget installs.
 */
export default function LanguageSwitcher({ variant = 'bar' }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(SOURCE_LANGUAGE.code);
  const [ready, setReady] = useState(false);
  const [applying, setApplying] = useState(null);

  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);

  // Reflect whatever language the page is actually in, including after a
  // reload or a change made through Google's own control.
  useEffect(() => {
    setActive(readActiveLanguage());
  }, []);

  /*
   * Wait for the translate widget.
   *
   * The script is loaded from Google with no callback we control, so the
   * select element appears at an unpredictable moment. Polling briefly is
   * simpler than racing it, and it lets the control show a disabled state
   * instead of accepting a click it cannot honour. Gives up after ~10s: if the
   * script is blocked (corporate proxy, ad blocker, offline) the switcher
   * hides itself rather than sitting there broken.
   */
  useEffect(() => {
    if (document.querySelector('.goog-te-combo')) {
      setReady(true);
      return undefined;
    }

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (document.querySelector('.goog-te-combo')) {
        setReady(true);
        clearInterval(timer);
      } else if (attempts > 40) {
        clearInterval(timer);
      }
    }, 250);

    return () => clearInterval(timer);
  }, []);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Move focus into the list when it opens, so keyboard users land on the
  // options rather than having to tab through the page.
  useEffect(() => {
    if (!open) return;
    const current =
      listRef.current?.querySelector('[aria-selected="true"]') ||
      listRef.current?.querySelector('[role="option"]');
    current?.focus();
  }, [open]);

  const choose = (code) => {
    const select = document.querySelector('.goog-te-combo');
    if (!select) return;

    setApplying(code);
    setOpen(false);

    select.value = code;
    // bubbles: true — Google's handler is attached further up in some builds of
    // the widget, and a non-bubbling event is silently ignored there.
    select.dispatchEvent(new Event('change', { bubbles: true }));

    setActive(code);

    // The widget rewrites the DOM asynchronously; clear the spinner once it
    // has had time to run rather than pretending it was instant.
    setTimeout(() => setApplying(null), 1200);
  };

  /** Arrow-key roving focus across the options. */
  const onListKeyDown = (e) => {
    const options = [...(listRef.current?.querySelectorAll('[role="option"]') || [])];
    if (!options.length) return;

    const index = options.indexOf(document.activeElement);

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next =
        e.key === 'ArrowDown'
          ? (index + 1) % options.length
          : (index - 1 + options.length) % options.length;
      options[next].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      options[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      options[options.length - 1].focus();
    } else if (e.key === 'Tab') {
      // Tabbing away from a popup should dismiss it.
      setOpen(false);
    }
  };

  // Script blocked or unavailable: offering a control that cannot work is
  // worse than offering none.
  if (!ready) return null;

  const current = findLanguage(active);
  const isTranslated = active !== SOURCE_LANGUAGE.code;

  const triggerClasses =
    variant === 'bar'
      ? 'inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm font-medium text-white transition hover:bg-white/20'
      : 'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 transition hover:border-gray-400';

  const renderOption = (lang) => {
    const selected = lang.code === active;
    return (
      <button
        key={lang.code}
        type="button"
        role="option"
        aria-selected={selected}
        lang={lang.code}
        dir={lang.rtl ? 'rtl' : undefined}
        onClick={() => choose(lang.code)}
        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:bg-[#8B0000]/10 ${
          selected
            ? 'bg-[#8B0000]/10 font-semibold text-[#8B0000]'
            : 'text-gray-800 hover:bg-gray-100'
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate">{lang.endonym}</span>
          {/* The English name is supplementary, so it is quieter. Omitted when
              it would just repeat the endonym (French/Français differ, but
              English/English does not). */}
          {lang.english !== lang.endonym && (
            <span className="block truncate text-[11px] font-normal text-gray-500">
              {lang.english}
            </span>
          )}
        </span>

        {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        // Names the control and its current value together, so a screen reader
        // announces "Language: हिन्दी" rather than just "button".
        aria-label={`Language: ${current.english}. Change language`}
        className={triggerClasses}
      >
        {applying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span lang={current.code} dir={current.rtl ? 'rtl' : undefined}>
          {current.endonym}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label="Select a language"
          onKeyDown={onListKeyDown}
          /* notranslate: the widget would otherwise translate the language
             names themselves, so after switching to Hindi every option would
             read in Hindi and the list would be useless for finding your way
             back. */
          className="notranslate absolute right-0 z-[70] mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 text-left shadow-2xl"
          translate="no"
        >
          {renderOption(SOURCE_LANGUAGE)}

          {isTranslated && (
            <p className="border-y border-gray-100 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900">
              Translated automatically by Google. The English version is
              authoritative.
            </p>
          )}

          {LANGUAGE_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="mt-1 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
              </p>
              {group.languages.map(renderOption)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
