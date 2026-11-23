import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import Loading from "../components/Loading";
import FacultySidebar from "../components/FacultySidebar";
import FacultyAccordion from "../components/FacultyAccordion";
import { publicAPI } from "../lib/api.js";
import SEO from "../components/SEO.jsx";
import { personSchema, breadcrumbSchema } from "../lib/structuredData.js";

export default function FacultyProfile() {
  const { slug } = useParams();

  const [faculty, setFaculty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await publicAPI.getPersonBySlug(slug);
        setFaculty(res?.data?.data || null);
      } catch (err) {
        console.error("Faculty profile load failed:", err);
        setError("Failed to load faculty profile.");
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchProfile();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loading />
      </div>
    );
  }

  if (error || !faculty) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-red-700 font-medium">
            {error || "Faculty profile not found."}
          </p>
        </div>
      </div>
    );
  }

  const researchArea =
    faculty.research_area || faculty.research_areas || "";
  const biography = faculty.biography || faculty.bio || "";

  return (
    <>
      <SEO
        title={`${faculty.name} — ${faculty.designation}`}
        description={`${faculty.name}, ${faculty.designation} at LNMIIT Jaipur.${
          researchArea ? ` Research interests: ${researchArea}` : ""
        }`.slice(0, 160)}
        keywords={[faculty.name, researchArea, "LNMIIT CSE", "faculty"]
          .filter(Boolean)
          .join(", ")}
        type="profile"
        image={faculty.photo_path}
        structuredData={[
          personSchema(faculty),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "People", path: "/people" },
            {
              name: faculty.name,
              path: `/people/${faculty.slug || slug}`,
            },
          ]),
        ].filter(Boolean)}
      />

      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-4 gap-10">
          <FacultySidebar faculty={faculty} />

          {/* A div, not <main>: PublicLayout already supplies the page's main
              landmark, and nesting two is invalid. */}
          <div className="lg:col-span-3 space-y-12">
            {faculty.summary && (
              <section>
                <h1 className="font-serif text-3xl lg:text-4xl font-bold mb-3">
                  Summary
                </h1>
                <p className="text-gray-800 leading-relaxed whitespace-pre-line text-justify">
                  {faculty.summary}
                </p>
              </section>
            )}

            {biography && (
              <section>
                <h2 className="font-serif text-2xl lg:text-3xl font-bold mb-3">
                  Biography
                </h2>
                <p className="text-gray-800 leading-relaxed whitespace-pre-line text-justify">
                  {biography}
                </p>
              </section>
            )}

            {researchArea && (
              <section>
                <h2
                  className={`font-serif font-bold mb-3 ${
                    faculty.summary || biography
                      ? "text-2xl lg:text-3xl"
                      : "text-3xl lg:text-4xl"
                  }`}
                >
                  Research Area
                </h2>

                <p className="text-gray-800 leading-relaxed">
                  {researchArea}
                </p>
              </section>
            )}

            {/* Research linked relationally via research_authors. Distinct
                from the free-text `publications` field, which the accordion
                sections below still render. */}
            {Array.isArray(faculty.linkedResearch) &&
              faculty.linkedResearch.length > 0 && (
                <section>
                  <h2 className="font-serif text-2xl lg:text-3xl font-bold mb-4">
                    Research &amp; Publications
                  </h2>

                  <ul className="space-y-3">
                    {faculty.linkedResearch.map((item) => (
                      <li key={`${item.id}-${item.role}`}>
                        <Link
                          to={item.url}
                          className="block rounded-lg border border-gray-200 p-4 transition hover:border-[#8B0000]/40 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-medium text-gray-900">
                              {item.title}
                            </span>
                            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
                              {item.category}
                            </span>
                          </div>

                          {(item.journal || item.year || item.status) && (
                            <p className="mt-1 text-sm text-gray-600">
                              {[item.journal, item.year, item.status]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

            <div className="space-y-4">
              {Array.isArray(faculty.sections) && faculty.sections.length > 0 ? (
                faculty.sections.map((section, index) => (
                  <FacultyAccordion
                    key={`${section.title}-${index}`}
                    section={section}
                  />
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  No additional details available.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}