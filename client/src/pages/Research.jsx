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
      setResearch(res.data?.data || []);
    } finally {
      setLoading(false);
    }
  }

  const publications = useMemo(
    () => research.filter(r => r.category === "Publication"),
    [research]
  );

  const projects = useMemo(
    () => research.filter(r => r.category === "Project"),
    [research]
  );

  const patents = useMemo(
    () => research.filter(r => r.category === "Patent"),
    [research]
  );

  const collaborations = useMemo(
    () => research.filter(r => r.category === "Collaboration"),
    [research]
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
            {publications.map(p => (
              <div key={p.id} className="border-b pb-4 mb-4">
                <div className="font-semibold">{p.title}</div>
                <div className="text-sm text-gray-600">
                  {p.authors} — {p.journal} ({p.year})
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* PROJECTS (TABLE LIKE LNMIIT) */}
        {(!typeParam || typeParam === "Project") && (
          <Section title="Sponsored Research Projects">
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
                  {projects.map(p => (
                    <tr key={p.id} className="border-t">
                      <td className="p-3">{p.title}</td>
                      <td className="p-3">{p.funding_agency}</td>
                      <td className="p-3">{p.pi_co_pi || p.faculty}</td>
                      <td className="p-3">{p.funding_amount}</td>
                      <td className="p-3">{p.duration}</td>
                      <td className="p-3">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* PATENTS */}
        {(!typeParam || typeParam === "Patent") && (
          <Section title="IPR">
            <table className="w-full border">
              <thead className="bg-[#8B0000] text-white">
                <tr>
                  <th className="p-3">Title</th>
                  <th className="p-3">Inventors</th>
                  <th className="p-3">Application</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {patents.map(p => (
                  <tr key={p.id}>
                    <td className="p-3">{p.title}</td>
                    <td className="p-3">{p.inventors}</td>
                    <td className="p-3">{p.application_no}</td>
                    <td className="p-3">{p.patent_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* COLLABORATIONS */}
        {(!typeParam || typeParam === "Collaboration") && (
          <Section title="Collaborations">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {collaborations.map(c => (
                <div key={c.id} className="text-center">
                  <img src={c.image_path} className="h-20 mx-auto" />
                  <div>{c.collaboration_org}</div>
                </div>
              ))}
            </div>
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