import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { publicAPI } from "../lib/api.js";
import { Download, ChevronDown, ChevronUp } from "lucide-react";
import CurriculumTable from "../components/CurriculumTable.jsx";

export default function Programs() {
  const location = useLocation();

  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);

  const [programDetails, setProgramDetails] = useState({});
  const [expandedPrograms, setExpandedPrograms] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  /* ================= LOAD PROGRAM LIST ================= */

  useEffect(() => {
    loadPrograms();
  }, [page]);

  async function loadPrograms() {
    setLoadingPrograms(true);

    try {
      const resp = await publicAPI.getPrograms({
        page,
        limit: 6,
      });

      setPrograms(resp.data?.data || []);
      setTotalPages(resp.data?.meta?.totalPages || 1);
    } catch (err) {
      console.error("Failed to load programs", err);
    } finally {
      setLoadingPrograms(false);
    }
  }

  /* ================= HASH NAVIGATION ================= */

  const activeHash = useMemo(() => {
    return location.hash.replace("#", "") || "doctoral";
  }, [location.hash]);

  /* ================= GROUP PROGRAMS ================= */

  const groupedPrograms = useMemo(
    () => ({
      doctoral: programs.filter((p) => p.level === "PhD"),
      masters: programs.filter((p) => p.level === "PG"),
      bachelors: programs.filter((p) => p.level === "UG"),
    }),
    [programs],
  );

  /* ================= SCROLL FIX ================= */

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeHash]);

  /* ================= LOAD PROGRAM DETAILS ================= */

  async function ensureProgramDetails(programId) {
    if (programDetails[programId]) return;

    try {
      const resp = await publicAPI.getProgramDetails(programId);

      setProgramDetails((prev) => ({
        ...prev,
        [programId]: resp.data?.data || null,
      }));
    } catch (err) {
      console.error(err);

      setProgramDetails((prev) => ({
        ...prev,
        [programId]: { error: true },
      }));
    }
  }

  /* ================= TOGGLE PROGRAM ================= */

  function toggleProgram(programId) {
    ensureProgramDetails(programId);

    setExpandedPrograms((prev) => ({
      ...prev,
      [programId]: !prev[programId],
    }));
  }

  /* ================= TOGGLE SECTION ================= */

  function toggleSection(programId, sectionId) {
    ensureProgramDetails(programId);

    setExpandedSections((prev) => ({
      ...prev,
      [programId]: {
        ...(prev[programId] || {}),
        [sectionId]: !prev[programId]?.[sectionId],
      },
    }));
  }

  /* ================= PROGRAM LOADING ================= */

  if (loadingPrograms) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin h-8 w-8 border-b-2 border-red-700 rounded-full" />
      </div>
    );
  }

  /* ================= SECTION RENDERER ================= */

  const renderSection = (title, list) => {
    if (!list || list.length === 0) return null;

    return (
      <section className="mb-24">
        <div className="flex items-end justify-between gap-4 mb-10">
          <h2 className="text-4xl font-serif font-bold text-gray-900">
            {title}
          </h2>
          <div className="hidden md:block h-[2px] flex-1 bg-gradient-to-r from-red-800 to-transparent ml-6 rounded-full" />
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {list.map((program) => {
            const details = programDetails[program.id];
            const isOpen = !!expandedPrograms[program.id];
            const sectionState = expandedSections[program.id] || {};

            return (
              <div
                key={program.id}
                className="self-start rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                {/* ================= CARD TOP ================= */}

                <div className="p-6 md:p-7">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="space-y-1">
                      <div className="inline-flex items-center rounded-full bg-red-50 text-red-800 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                        Program
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 leading-snug">
                        {program.name}
                      </h3>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4 text-sm text-gray-700">
                    <span className="rounded-full bg-gray-100 px-3 py-1">
                      <strong>Level:</strong> {program.level}
                    </span>
                    {program.duration && (
                      <span className="rounded-full bg-gray-100 px-3 py-1">
                        <strong>Duration:</strong> {program.duration}
                      </span>
                    )}
                    {program.total_credits && (
                      <span className="rounded-full bg-gray-100 px-3 py-1">
                        <strong>Credits:</strong> {program.total_credits}
                      </span>
                    )}
                  </div>

                  {program.overview && (
                    <p className="text-gray-600 text-sm leading-6 mb-5">
                      {program.overview}
                    </p>
                  )}

                  {/* TOGGLE BUTTON */}

                  <button
                    onClick={() => toggleProgram(program.id)}
                    className="inline-flex items-center gap-2 text-red-700 font-semibold hover:text-red-800 transition-colors"
                  >
                    {isOpen ? "Hide Details" : "View Details"}
                    {isOpen ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                </div>

                {/* ================= EXPANDED CONTENT ================= */}

                {isOpen && (
                  <div className="border-t border-gray-200 bg-gradient-to-b from-gray-50 to-white p-6 md:p-7">
                    {/* DOWNLOAD BUTTON */}

                    {program.curriculum_pdf_path && (
                      <a
                        href={program.curriculum_pdf_path}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 bg-red-700 text-white px-5 py-3 rounded-xl hover:bg-red-800 transition-colors shadow-sm mb-6"
                      >
                        <Download size={16} />
                        Download Curriculum
                      </a>
                    )}

                    {/* PROGRAM STRUCTURE */}

                    <div className="mb-6">
                      <div className="inline-flex items-center bg-red-800 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm">
                        Programme Structure
                      </div>
                      <div className="border-t border-gray-300 mt-3" />
                    </div>

                    {/* DETAILS */}

                    {!details ? (
                      <button
                        type="button"
                        onClick={() => ensureProgramDetails(program.id)}
                        className="w-full text-left cursor-pointer border border-dashed border-gray-300 p-4 rounded-xl hover:bg-white hover:border-gray-400 transition-colors text-gray-700"
                      >
                        Click to load programme details...
                      </button>
                    ) : details.error ? (
                      <p className="text-red-600 font-medium">
                        Failed to load programme details.
                      </p>
                    ) : details.sections?.length ? (
                      <div className="space-y-4">
                        {details.sections.map((section) => {
                          const open = !!sectionState[section.id];

                          return (
                            <div
                              key={section.id}
                              className="rounded-xl border border-gray-200 overflow-hidden bg-white"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  toggleSection(program.id, section.id)
                                }
                                className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-red-800 text-white font-semibold text-sm hover:bg-red-900 transition-colors"
                              >
                                <span className="text-left">
                                  {section.title}
                                </span>
                                {open ? (
                                  <ChevronUp size={18} />
                                ) : (
                                  <ChevronDown size={18} />
                                )}
                              </button>

                              {open && (
                                <div className="p-5 bg-white border-t border-gray-200">
                                  {section.content?.content_html && (
                                    <div
                                      className="prose max-w-none mb-6 prose-headings:font-serif prose-headings:text-gray-900 prose-p:text-gray-700"
                                      dangerouslySetInnerHTML={{
                                        __html: section.content.content_html,
                                      }}
                                    />
                                  )}

                                  {section.semesters?.map((sem) => (
                                    <div
                                      key={sem.id}
                                      className="mb-6 last:mb-0"
                                    >
                                      <div className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-800 mb-3">
                                        {sem.semester_name}
                                      </div>
                                      <CurriculumTable
                                        courses={sem.courses || []}
                                      />
                                    </div>
                                  ))}

                                  {section.outcomes?.length > 0 && (
                                    <div className="space-y-3 pt-2">
                                      {section.outcomes.map((o) => (
                                        <div
                                          key={o.id}
                                          className="flex gap-3 text-sm leading-6"
                                        >
                                          <div className="min-w-20 font-semibold text-gray-900">
                                            {o.outcome_code}
                                          </div>
                                          <div className="text-gray-700">
                                            {o.outcome_text}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="italic text-gray-600">
                        No sections available.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-center mt-10 gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Prev
          </button>

          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`px-4 py-2 border rounded ${
                page === i + 1 ? "bg-red-700 text-white" : "bg-white"
              }`}
            >
              {i + 1}
            </button>
          ))}

          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </section>
    );
  };

  /* ================= PAGE ================= */

  return (
    <div className="bg-white px-6 py-10 md:px-12 lg:px-16">
      <div className="max-w-6xl mx-auto">
        {activeHash === "doctoral" &&
          renderSection("Doctoral Programmes", groupedPrograms.doctoral)}

        {activeHash === "masters" &&
          renderSection("Masters Programmes", groupedPrograms.masters)}

        {activeHash === "bachelors" &&
          renderSection("Bachelors Programmes", groupedPrograms.bachelors)}
      </div>
    </div>
  );
}
