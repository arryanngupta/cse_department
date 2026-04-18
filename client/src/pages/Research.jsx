import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { publicAPI } from "../lib/api.js";
import Loading from "../components/Loading.jsx";

export default function Research() {
  const [research, setResearch] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const typeParam = searchParams.get("type");

  useEffect(() => {
    loadResearch();
  }, []);

  async function loadResearch() {
    try {
      setLoading(true);
      const res = await publicAPI.getResearch();
      const raw = res.data?.data || [];
      setResearch(raw.map(normalizeResearchItem));
    } finally {
      setLoading(false);
    }
  }

  function normalizeResearchItem(item) {
    return {
      ...item,
      content_json: parseContentJSON(item?.content_json),
    };
  }

  function parseContentJSON(value) {
    if (!value) return null;

    if (Array.isArray(value)) return value;

    if (typeof value === "object") return value;

    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }

    return null;
  }

  function renderBlocks(blocks) {
    if (!blocks) return null;

    const blockList = Array.isArray(blocks) ? blocks : [blocks];

    return blockList.map((block, i) => {
      if (!block || typeof block !== "object") return null;

      if (block.type === "table") {
        return (
          <div key={`${block.type}-${i}`} className="overflow-x-auto mb-10">
            {block.title && (
              <h3 className="text-xl font-semibold mb-4 text-[#A6192E]">
                {block.title}
              </h3>
            )}

            <table className="w-full border text-sm">
              <thead className="bg-[#8B0000] text-white">
                <tr>
                  {(block.columns || []).map((col, idx) => (
                    <th
                      key={idx}
                      className="p-3 text-left border border-white/20"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(block.rows || []).map((row, rIdx) => (
                  <tr key={rIdx} className="border-t">
                    {(row || []).map((cell, cIdx) => (
                      <td key={cIdx} className="p-3 align-top">
                        {renderCell(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      if (block.type === "text") {
        return (
          <div key={`${block.type}-${i}`} className="mb-5">
            {block.title && (
              <h3 className="text-xl font-semibold mb-3 text-[#A6192E]">
                {block.title}
              </h3>
            )}
            <p className="text-gray-800 leading-7 whitespace-pre-line">
              {block.content || ""}
            </p>
          </div>
        );
      }

      if (block.type === "image") {
        return (
          <div key={`${block.type}-${i}`} className="mb-8">
            {block.title && (
              <h3 className="text-xl font-semibold mb-3 text-[#A6192E]">
                {block.title}
              </h3>
            )}
            {block.src && (
              <img
                src={block.src}
                alt={block.alt || block.title || "research"}
                className="w-full max-w-4xl rounded-lg shadow-sm mb-3"
              />
            )}
            {block.caption && (
              <p className="text-sm text-gray-600">{block.caption}</p>
            )}
          </div>
        );
      }

      if (block.type === "accordion") {
        return (
          <div key={`${block.type}-${i}`} className="mb-6 border rounded-lg">
            <details className="group">
              <summary className="cursor-pointer list-none p-4 font-semibold text-[#A6192E] bg-gray-50">
                {block.title || "Details"}
              </summary>
              <div className="p-4 border-t">
                {block.content && (
                  <p className="text-gray-800 whitespace-pre-line leading-7">
                    {block.content}
                  </p>
                )}

                {Array.isArray(block.items) && block.items.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {block.items.map((item, idx) => (
                      <div key={idx} className="border rounded-md p-3">
                        {item.heading && (
                          <div className="font-semibold mb-1">
                            {item.heading}
                          </div>
                        )}
                        {item.text && (
                          <div className="text-sm text-gray-700 whitespace-pre-line">
                            {item.text}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          </div>
        );
      }

      if (block.type === "card_grid") {
        return (
          <div key={`${block.type}-${i}`} className="mb-10">
            {block.title && (
              <h3 className="text-xl font-semibold mb-4 text-[#A6192E]">
                {block.title}
              </h3>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(block.items || []).map((item, idx) => (
                <div key={idx} className="border rounded-lg p-4 shadow-sm">
                  {item.title && (
                    <div className="font-semibold mb-2">{item.title}</div>
                  )}
                  {item.text && (
                    <div className="text-sm text-gray-700 whitespace-pre-line">
                      {item.text}
                    </div>
                  )}
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-3 text-[#A6192E] text-sm font-medium"
                    >
                      Read more
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      }

      return null;
    });
  }

  function renderCell(cell) {
    if (cell === null || cell === undefined) return "";

    if (typeof cell === "string" || typeof cell === "number") {
      return cell;
    }

    if (typeof cell === "object") {
      if (cell.title || cell.text || cell.content) {
        return (
          <div>
            {cell.title && <div className="font-medium">{cell.title}</div>}
            {cell.text && <div className="text-sm">{cell.text}</div>}
            {cell.content && <div className="text-sm">{cell.content}</div>}
          </div>
        );
      }

      return JSON.stringify(cell);
    }

    return String(cell);
  }

  const publications = useMemo(
    () => research.filter((r) => r.category === "Publication"),
    [research],
  );

  const projects = useMemo(
    () => research.filter((r) => r.category === "Project"),
    [research],
  );

  const patents = useMemo(
    () => research.filter((r) => r.category === "Patent"),
    [research],
  );

  const collaborations = useMemo(
    () => research.filter((r) => r.category === "Collaboration"),
    [research],
  );

  if (loading) return <Loading />;

  return (
    <div className="bg-white px-8 py-12">
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-[#A6192E] mb-3">Research</h1>
          <div className="h-1 w-24 bg-[#A6192E] mx-auto" />
        </div>

        {/* PUBLICATIONS */}
        {(!typeParam || typeParam === "Publication") && (
          <Section title="Research Publications">
            {publications.length === 0 ? (
              <div className="text-gray-500">No publications available.</div>
            ) : (
              publications.map((p) => (
                <div key={p.id} className="border-b pb-6 mb-8">
                  {/* 🔥 CASE 1: JSON EXISTS → FULL CONTROL */}
                  {p.content_json ? (
                    <>
                      <div className="text-xl font-semibold mb-2 text-[#111]">
                        {p.title}
                      </div>

                      {renderBlocks(p.content_json)}
                    </>
                  ) : (
                    /* 🔥 CASE 2: NORMAL FIELDS */
                    <>
                      <div className="font-semibold text-lg mb-1">
                        {p.title}
                      </div>

                      {(p.authors || p.journal || p.year) && (
                        <div className="text-sm text-gray-600">
                          {p.authors && <span>{p.authors}</span>}
                          {p.authors && (p.journal || p.year) && (
                            <span> — </span>
                          )}
                          {p.journal && <span>{p.journal}</span>}
                          {p.year && <span> ({p.year})</span>}
                        </div>
                      )}

                      {p.description && (
                        <p className="mt-2 text-gray-700 whitespace-pre-line">
                          {p.description}
                        </p>
                      )}

                      {p.link && (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block mt-2 text-[#A6192E] text-sm font-medium"
                        >
                          View link
                        </a>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </Section>
        )}

        {/* PROJECTS */}
        {(!typeParam || typeParam === "Project") && (
          <Section title="Sponsored Research Projects">
            {projects.length === 0 ? (
              <div className="text-gray-500">No projects available.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border text-sm">
                    <thead className="bg-[#8B0000] text-white">
                      <tr>
                        <th className="p-3 text-left">Title</th>
                        <th className="p-3 text-left">Funding Agency</th>
                        <th className="p-3 text-left">PI</th>
                        <th className="p-3 text-left">Funding</th>
                        <th className="p-3 text-left">Duration</th>
                        <th className="p-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="p-3 align-top">
                            <div className="font-medium">{p.title}</div>
                            {p.description && (
                              <div className="text-gray-600 text-xs mt-1 whitespace-pre-line">
                                {p.description}
                              </div>
                            )}
                          </td>
                          <td className="p-3 align-top">{p.funding_agency}</td>
                          <td className="p-3 align-top">
                            {p.pi_co_pi || p.faculty}
                          </td>
                          <td className="p-3 align-top">{p.funding_amount}</td>
                          <td className="p-3 align-top">{p.duration}</td>
                          <td className="p-3 align-top">{p.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {projects
                  .filter((p) => p.content_json)
                  .map((p) => (
                    <div key={`project-block-${p.id}`} className="mt-10">
                      {renderBlocks(p.content_json)}
                    </div>
                  ))}
              </>
            )}
          </Section>
        )}

        {/* PATENTS */}
        {(!typeParam || typeParam === "Patent") && (
          <Section title="IPR">
            {patents.length === 0 ? (
              <div className="text-gray-500">No patents available.</div>
            ) : (
              <>
                <table className="w-full border">
                  <thead className="bg-[#8B0000] text-white">
                    <tr>
                      <th className="p-3 text-left">Title</th>
                      <th className="p-3 text-left">Inventors</th>
                      <th className="p-3 text-left">Application</th>
                      <th className="p-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patents.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-3 align-top">
                          <div className="font-medium">{p.title}</div>
                          {p.description && (
                            <div className="text-gray-600 text-xs mt-1 whitespace-pre-line">
                              {p.description}
                            </div>
                          )}
                        </td>
                        <td className="p-3 align-top">{p.inventors}</td>
                        <td className="p-3 align-top">{p.application_no}</td>
                        <td className="p-3 align-top">{p.patent_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {patents
                  .filter((p) => p.content_json)
                  .map((p) => (
                    <div key={`patent-block-${p.id}`} className="mt-10">
                      {renderBlocks(p.content_json)}
                    </div>
                  ))}
              </>
            )}
          </Section>
        )}

        {/* COLLABORATIONS */}
        {(!typeParam || typeParam === "Collaboration") && (
          <Section title="Collaborations">
            {collaborations.length === 0 ? (
              <div className="text-gray-500">No collaborations available.</div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {collaborations.map((c) => (
                    <div key={c.id} className="text-center">
                      {c.image_path ? (
                        <img
                          src={c.image_path}
                          alt={
                            c.collaboration_org || c.title || "collaboration"
                          }
                          className="h-20 mx-auto object-contain"
                        />
                      ) : (
                        <div className="h-20 mx-auto flex items-center justify-center border rounded bg-gray-50 text-xs text-gray-400">
                          No image
                        </div>
                      )}
                      <div className="mt-2 text-sm">{c.collaboration_org}</div>
                    </div>
                  ))}
                </div>

                {collaborations
                  .filter((c) => c.content_json)
                  .map((c) => (
                    <div key={`collab-block-${c.id}`} className="mt-10">
                      {renderBlocks(c.content_json)}
                    </div>
                  ))}
              </>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

const Section = ({ title, children }) => (
  <section className="mb-20">
    <h2 className="text-3xl font-serif border-b-4 border-black pb-3 mb-8">
      {title}
    </h2>
    {children}
  </section>
);
