import { useLocation } from "react-router-dom";

import useHead from "../lib/head.js";
import { SITE_URL, organisationSchema } from "../lib/structuredData.js";

const SITE_NAME = "CSE Department · LNMIIT Jaipur";

const DEFAULT_DESCRIPTION =
  "Department of Computer Science & Engineering at The LNM Institute of Information Technology, Jaipur — faculty, programmes, research, facilities and events.";

/**
 * Per-page document head.
 *
 * Canonical URLs are derived from the current route rather than requiring every
 * page to pass one, because a missing canonical is how duplicate-content
 * problems start. Pass `canonical` only to override.
 *
 * `structuredData` accepts a JSON-LD object or an array of them; the department
 * node is always included. The builders live in lib/structuredData.js.
 *
 * Renders nothing — it writes to document.head through useHead.
 */
const SEO = ({
  title,
  description,
  keywords,
  canonical,
  image,
  type = "website",
  noindex = false,
  structuredData,
}) => {
  const { pathname } = useLocation();

  const url = canonical || `${SITE_URL}${pathname}`;
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const desc = description || DEFAULT_DESCRIPTION;

  // Absolute URLs only: relative paths break every crawler and share preview.
  const rawImage = image || "/og-image.png";
  const ogImage = /^https?:\/\//i.test(rawImage)
    ? rawImage
    : `${SITE_URL}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`;

  const extra = structuredData ? [].concat(structuredData).filter(Boolean) : [];
  const graph = [organisationSchema(), ...extra];

  useHead([
    { type: "title", content: fullTitle },
    { type: "meta", name: "description", content: desc },
    { type: "meta", name: "keywords", content: keywords },
    { type: "link", rel: "canonical", content: url },

    // Admin and transient pages should stay out of the index.
    noindex ? { type: "meta", name: "robots", content: "noindex,nofollow" } : null,

    { type: "meta", property: "og:site_name", content: SITE_NAME },
    { type: "meta", property: "og:title", content: fullTitle },
    { type: "meta", property: "og:description", content: desc },
    { type: "meta", property: "og:type", content: type },
    { type: "meta", property: "og:url", content: url },
    { type: "meta", property: "og:image", content: ogImage },
    { type: "meta", property: "og:locale", content: "en_IN" },

    // summary_large_image renders the share card with a wide preview.
    { type: "meta", name: "twitter:card", content: "summary_large_image" },
    { type: "meta", name: "twitter:title", content: fullTitle },
    { type: "meta", name: "twitter:description", content: desc },
    { type: "meta", name: "twitter:image", content: ogImage },

    {
      type: "script",
      scriptType: "application/ld+json",
      content: JSON.stringify(graph),
    },
  ]);

  return null;
};

export default SEO;
