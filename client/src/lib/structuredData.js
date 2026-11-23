// client/src/lib/structuredData.js
//
// schema.org JSON-LD builders.
//
// These live outside SEO.jsx so that file exports only a component (React Fast
// Refresh requires it, and ESLint enforces it).
//
// Each builder maps real record fields onto schema.org types. Optional fields
// are omitted rather than guessed: structured data that asserts something the
// page does not actually say is worse than no structured data at all, and
// search engines penalise it.

export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || "https://cse.lnmiit.ac.in"
).replace(/\/$/, "");

const DEPARTMENT = {
  "@type": "CollegeOrUniversity",
  name: "Department of Computer Science & Engineering, LNMIIT",
};

const INSTITUTE = {
  "@type": "CollegeOrUniversity",
  name: "The LNM Institute of Information Technology",
  url: "https://lnmiit.ac.in",
};

/** Identifies the department itself. Emitted on every page. */
export const organisationSchema = () => ({
  "@context": "https://schema.org",
  ...DEPARTMENT,
  alternateName: "LNMIIT CSE",
  url: SITE_URL,
  parentOrganization: INSTITUTE,
  address: {
    "@type": "PostalAddress",
    streetAddress: "Rupa ki Nangal, Post-Sumel, Via Jamdoli",
    addressLocality: "Jaipur",
    addressRegion: "Rajasthan",
    postalCode: "302031",
    addressCountry: "IN",
  },
  telephone: "+91-141-268-8090",
  email: "info.lnmiit@lnmiit.ac.in",
});

export const personSchema = (person) => {
  if (!person?.name) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    worksFor: DEPARTMENT,
  };

  if (person.designation) data.jobTitle = person.designation;
  if (person.email) data.email = person.email;
  if (person.webpage) data.url = person.webpage;
  if (person.photo_path) data.image = person.photo_path;

  const areas = person.research_areas || person.research_area;
  if (areas) {
    data.knowsAbout = String(areas)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return data;
};

export const eventSchema = (event) => {
  if (!event?.title || !event?.startsAt) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.startsAt,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    organizer: DEPARTMENT,
  };

  if (event.endsAt) data.endDate = event.endsAt;
  if (event.description) data.description = event.description;
  if (event.banner_path || event.image_path) {
    data.image = event.banner_path || event.image_path;
  }
  if (event.venue) {
    data.location = {
      "@type": "Place",
      name: event.venue,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Jaipur",
        addressRegion: "Rajasthan",
        addressCountry: "IN",
      },
    };
  }

  return data;
};

export const articleSchema = (article) => {
  if (!article?.title) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    publisher: DEPARTMENT,
  };

  if (article.date) data.datePublished = article.date;
  if (article.summary) data.description = article.summary;
  if (article.image_path || article.banner_path) {
    data.image = article.image_path || article.banner_path;
  }

  return data;
};

export const courseSchema = (program) => {
  if (!program?.name) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: program.name,
    provider: INSTITUTE,
  };

  const description = program.overview || program.description;
  if (description) data.description = description;

  return data;
};

/** Breadcrumbs let search engines show the site hierarchy under a result. */
export const breadcrumbSchema = (crumbs = []) => {
  if (!crumbs.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.path}`,
    })),
  };
};
