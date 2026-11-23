// client/src/lib/head.js
//
// Minimal document-head manager.
//
// Why this exists instead of react-helmet-async: that package (2.0.5, the
// latest release) renders nothing at all under React 19 — it injects no tags
// and never sets document.title. Verified in a browser against this app: zero
// [data-rh] nodes, zero JSON-LD scripts, document.title left at the static
// index.html value. It does not declare React 19 as a peer dependency, and it
// is unmaintained. Every meta tag the site thought it was emitting was a no-op.
//
// So the head is managed directly. It is ~80 lines, has no dependencies, and
// the behaviour is observable in the DOM.
//
// Contract:
//   - A tag whose element already exists in the head (e.g. the static
//     <meta name="description"> in index.html) is UPDATED, not duplicated —
//     crawlers read the first match, so appending a second one would be
//     ignored. The original value is restored on unmount.
//   - A tag with no existing element is created and removed on unmount.
//   - Several SEO components mounting at once each own their own nodes, so one
//     unmounting does not strip another's tags.

import { useEffect, useRef } from "react";

let instanceSeq = 0;

/** CSS selector that identifies the single element a tag spec refers to. */
const selectorFor = (tag) => {
  if (tag.type === "title") return "title";
  if (tag.type === "meta" && tag.name) return `meta[name="${tag.name}"]`;
  if (tag.type === "meta" && tag.property) {
    return `meta[property="${tag.property}"]`;
  }
  if (tag.type === "link") return `link[rel="${tag.rel}"]`;
  if (tag.type === "script") return `script[type="${tag.scriptType}"]`;
  return null;
};

/** Apply a spec's value to a concrete element. */
const applyTo = (el, tag) => {
  if (tag.type === "title" || tag.type === "script") {
    el.textContent = tag.content;
  } else if (tag.type === "link") {
    el.setAttribute("href", tag.content);
  } else {
    el.setAttribute("content", tag.content);
  }
};

/** Read back whatever the element currently holds, so it can be restored. */
const valueOf = (el, tag) => {
  if (tag.type === "title" || tag.type === "script") return el.textContent;
  if (tag.type === "link") return el.getAttribute("href");
  return el.getAttribute("content");
};

const createFor = (tag, owner) => {
  const el = document.createElement(tag.type);
  if (tag.name) el.setAttribute("name", tag.name);
  if (tag.property) el.setAttribute("property", tag.property);
  if (tag.rel) el.setAttribute("rel", tag.rel);
  if (tag.scriptType) el.setAttribute("type", tag.scriptType);
  el.setAttribute("data-head", owner);
  applyTo(el, tag);
  return el;
};

/**
 * Sync a list of head tags with the document.
 *
 * `tags` is re-serialised each render, so the effect only re-runs when the
 * resolved values actually change — not on every parent re-render.
 */
export default function useHead(tags) {
  const ownerRef = useRef(null);
  if (ownerRef.current === null) {
    instanceSeq += 1;
    ownerRef.current = `h${instanceSeq}`;
  }

  // Tags without a value are dropped rather than written as empty attributes.
  const resolved = tags.filter(
    (t) => t && t.content !== undefined && t.content !== null && t.content !== "",
  );
  const key = JSON.stringify(resolved);

  useEffect(() => {
    const owner = ownerRef.current;
    const head = document.head;

    /** Elements we created, to delete on cleanup. */
    const created = [];
    /** Elements we only edited, with their original values, to restore. */
    const edited = [];

    for (const tag of resolved) {
      const selector = selectorFor(tag);
      if (!selector) continue;

      const existing = head.querySelector(selector);

      if (existing && !existing.hasAttribute("data-head")) {
        edited.push({ el: existing, tag, previous: valueOf(existing, tag) });
        applyTo(existing, tag);
      } else if (existing && existing.getAttribute("data-head") !== owner) {
        // Another SEO instance owns this tag. Leave it alone rather than
        // fighting over it; the deepest-mounted component wins on its own
        // tags and we do not clobber someone else's.
        continue;
      } else {
        const el = existing || createFor(tag, owner);
        if (!existing) head.appendChild(el);
        else applyTo(el, tag);
        created.push(el);
      }
    }

    return () => {
      for (const el of created) el.remove();
      for (const { el, tag, previous } of edited) {
        applyTo(el, { ...tag, content: previous });
      }
    };
    // `key` is the serialised form of `resolved`; re-running on the array
    // identity instead would fire on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
