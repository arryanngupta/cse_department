import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import Loading from "../components/Loading";
import FacultySidebar from "../components/FacultySidebar";
import FacultyAccordion from "../components/FacultyAccordion";
import { publicAPI } from "../lib/api.js";
import SEO from "../components/SEO.jsx";

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
        title={`${faculty.name} — ${faculty.designation} | Department of CSE | LNMIIT Jaipur`}
        description={`${faculty.name}, ${faculty.designation} at LNMIIT Jaipur. Research interests: ${researchArea || "Not specified."}`}
        keywords={`${faculty.name}, ${researchArea || ""}, LNMIIT CSE, faculty`}
        canonical={`https://cse.lnmiit.ac.in/people/${faculty.slug || slug}`}
      />

      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-4 gap-10">
          <FacultySidebar faculty={faculty} />

          <main className="lg:col-span-3 space-y-12">
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
          </main>
        </div>
      </div>
    </>
  );
}