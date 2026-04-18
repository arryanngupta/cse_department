import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicAPI } from '../lib/api.js';
import { ChevronDown, ChevronUp, FileText, ArrowRight } from 'lucide-react';

const GROUP_ORDER = ['faculty', 'research', 'non_academic', 'general'];

const SECTION_TITLES = {
  faculty: 'Faculty Positions',
  research: 'Research Positions',
  non_academic: 'Non-academic Positions',
  general: 'Related Links & Notices',
};

function Opportunities() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAccordions, setOpenAccordions] = useState({});

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    try {
      const resp = await publicAPI.getOpportunities();
      setItems(resp.data?.data || []);
    } catch (error) {
      console.error('Failed to load opportunities', error);
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const byGroup = {
      faculty: [],
      research: [],
      non_academic: [],
      general: [],
    };

    for (const item of items) {
      if (item?.is_active === false) continue;
      if (!byGroup[item.page_group]) byGroup.general.push(item);
      else byGroup[item.page_group].push(item);
    }

    for (const key of GROUP_ORDER) {
      byGroup[key].sort(
        (a, b) =>
          (Number(a.display_order) || 0) - (Number(b.display_order) || 0) ||
          (Number(a.id) || 0) - (Number(b.id) || 0)
      );
    }

    return byGroup;
  }, [items]);

  const introBlock = useMemo(() => {
    const generalItems = grouped.general || [];
    return (
      generalItems.find((item) =>
        ['hero', 'note', 'rich_text'].includes(item.block_type)
      ) || null
    );
  }, [grouped.general]);

  const generalSectionItems = useMemo(() => {
    return (grouped.general || []).filter((item) => item.id !== introBlock?.id);
  }, [grouped.general, introBlock]);

  const toggleNestedAccordion = (parentId, index) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [parentId]: {
        ...(prev[parentId] || {}),
        [index]: !prev[parentId]?.[index],
      },
    }));
  };

  const openOpportunityDetails = (id) => {
    if (!id) return;
    navigate(`/opportunities/${id}`);
  };

  const renderDetailAction = (item) => {
    if (!item?.id) return null;

    return (
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => openOpportunityDetails(item.id)}
          className="inline-flex items-center gap-2 rounded-full border border-red-800 px-4 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-800 hover:text-white"
        >
          <span>View details</span>
          <ArrowRight size={16} />
        </button>
      </div>
    );
  };

  const renderHero = (item, index = 0, compact = false) => {
    const isAlt = index % 2 === 1;

    return (
      <div className="space-y-4">
        <div
          className={`grid items-center gap-8 lg:grid-cols-2 ${
            isAlt ? 'lg:[&>*:first-child]:order-2' : ''
          }`}
        >
          <div className="order-2 lg:order-1">
            {item.subtitle && (
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-red-800/80">
                {item.subtitle}
              </p>
            )}

            <h2
              className={`font-serif text-slate-900 ${
                compact ? 'text-3xl md:text-4xl' : 'text-4xl md:text-5xl'
              }`}
            >
              {item.title}
            </h2>

            {item.description && (
              <p
                className={`mt-5 leading-8 text-slate-700 ${
                  compact ? 'max-w-3xl text-base md:text-lg' : 'max-w-4xl text-lg'
                }`}
              >
                {item.description}
              </p>
            )}

            {item.cta_text && item.cta_url && (
              <a
                href={item.cta_url}
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-900"
              >
                {item.cta_text}
                <ArrowRight size={16} />
              </a>
            )}
          </div>

          <div className="order-1 lg:order-2">
            {item.image_path ? (
              <img
                src={item.image_path}
                alt={item.title}
                className="h-full w-full rounded-3xl object-cover shadow-sm ring-1 ring-slate-200"
              />
            ) : (
              <div className="flex min-h-[260px] items-center justify-center rounded-3xl bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                <div className="text-center">
                  <div className="mb-2 text-sm font-medium">No image uploaded</div>
                  <div className="text-xs">Add one from the admin panel</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {renderDetailAction(item)}
      </div>
    );
  };

  const renderButtonGroup = (item) => {
    const buttons = item.content_json?.buttons || item.content_json?.items || [];

    if (!buttons.length) {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {buttons.map((btn, idx) => {
            const label = btn.label || btn.text || btn.title || 'Open';
            const url = btn.url || btn.href || btn.link || '#';

            return (
              <a
                key={`${item.id}-${idx}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-red-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-900"
              >
                <FileText size={16} />
                <span>{label}</span>
              </a>
            );
          })}
        </div>

        {renderDetailAction(item)}
      </div>
    );
  };

  const renderLinks = (item) => {
    const links = item.content_json?.links || item.content_json?.items || [];

    if (!links.length) {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-3">
          {links.map((link, idx) => {
            const label = link.label || link.text || link.title || 'Open link';
            const url = link.url || link.href || link.link || '#';

            return (
              <a
                key={`${item.id}-${idx}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex w-fit items-center gap-2 text-blue-700 transition hover:text-blue-900 hover:underline"
              >
                <FileText size={16} />
                <span>{label}</span>
                <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
              </a>
            );
          })}
        </div>

        {renderDetailAction(item)}
      </div>
    );
  };

  const renderTable = (item) => {
    const columns =
      item.content_json?.columns ||
      item.content_json?.headers ||
      item.content_json?.headings ||
      [];

    const rows = item.content_json?.rows || item.content_json?.data || [];

    if (!rows.length) {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="w-full border-collapse text-left">
            {columns.length > 0 && (
              <thead className="bg-slate-50">
                <tr>
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
            )}

            <tbody>
              {rows.map((row, rIdx) => {
                const cells = Array.isArray(row)
                  ? row
                  : columns.length
                    ? columns.map((col) => row[col] ?? row[col?.toLowerCase?.()] ?? '—')
                    : Object.values(row);

                return (
                  <tr key={rIdx} className="odd:bg-white even:bg-slate-50/60">
                    {cells.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="border-b border-slate-100 px-4 py-3 align-top text-sm leading-7 text-slate-700"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {renderDetailAction(item)}
      </div>
    );
  };

  const renderAccordion = (item) => {
    const itemsList = item.content_json?.items || [];

    if (!itemsList.length) {
      return null;
    }

    const parentOpen = !!openAccordions[item.id];

    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() =>
              setOpenAccordions((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
            }
            className="flex w-full items-center justify-between gap-4 bg-red-800 px-5 py-4 text-left font-semibold text-white transition hover:bg-red-900"
          >
            <span>{item.title}</span>
            {parentOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {parentOpen && (
            <div className="space-y-3 bg-white p-4 md:p-5">
              {itemsList.map((acc, idx) => {
                const open = !!openAccordions[item.id]?.[idx];
                const accTitle = acc.title || acc.label || `Item ${idx + 1}`;
                const accHtml = acc.contentHtml || acc.content_html || acc.content || '';

                return (
                  <div key={idx} className="overflow-hidden rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => toggleNestedAccordion(item.id, idx)}
                      className="flex w-full items-center justify-between gap-4 bg-slate-50 px-4 py-3 text-left font-medium text-slate-800 transition hover:bg-slate-100"
                    >
                      <span>{accTitle}</span>
                      {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {open && accHtml && (
                      <div
                        className="bg-white px-4 py-4 text-sm leading-7 text-slate-700"
                        dangerouslySetInnerHTML={{ __html: accHtml }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {renderDetailAction(item)}
      </div>
    );
  };

  const renderNote = (item) => {
    const html = item.content_html || item.contentHtml || item.description || '';

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-slate-800">
          {html ? (
            <div
              className="leading-8"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="leading-8">{item.description || item.title}</p>
          )}
        </div>

        {renderDetailAction(item)}
      </div>
    );
  };

  const renderRichText = (item) => {
    const html = item.content_html || item.contentHtml || item.description || '';

    return (
      <div className="space-y-4 text-slate-700">
        {item.subtitle && (
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-800/80">
            {item.subtitle}
          </p>
        )}

        {item.title && item.title !== 'Careers' && (
          <h3 className="font-serif text-3xl text-slate-900">{item.title}</h3>
        )}

        {html ? (
          <div
            className="max-w-none leading-8"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="leading-8">{item.description}</p>
        )}

        {renderDetailAction(item)}
      </div>
    );
  };

  const renderBlock = (item, index = 0, compactHero = false) => {
    switch (item.block_type) {
      case 'hero':
        return renderHero(item, index, compactHero);

      case 'button_group':
        return renderButtonGroup(item);

      case 'accordion':
        return renderAccordion(item);

      case 'table':
        return renderTable(item);

      case 'links':
        return renderLinks(item);

      case 'note':
        return renderNote(item);

      case 'rich_text':
      default:
        return renderRichText(item);
    }
  };

  const renderIntro = () => {
    if (!introBlock) {
      return (
        <p className="max-w-4xl text-lg leading-8 text-slate-700">
          Explore current openings, recruitment notices, and related opportunities at LNMIIT.
        </p>
      );
    }

    return renderBlock(introBlock, 0, true);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-red-800" />
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-white to-slate-50 px-4 py-10 md:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-800/80">
            Opportunities
          </p>
          <h1 className="mt-3 font-serif text-4xl text-slate-900 md:text-5xl">
            Careers
          </h1>
          <div className="mt-6 h-px w-full bg-slate-900/90" />
          <div className="mt-7">{renderIntro()}</div>
        </div>

        {(grouped.faculty.length > 0 ||
          grouped.research.length > 0 ||
          grouped.non_academic.length > 0 ||
          generalSectionItems.length > 0) && (
          <div className="space-y-16">
            {GROUP_ORDER.map((group) => {
              const groupItems =
                group === 'general' ? generalSectionItems : grouped[group];

              if (!groupItems?.length) return null;

              return (
                <section
                  key={group}
                  className="rounded-[28px] bg-white/80 p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8"
                >
                  <div className="mb-8 flex items-center gap-3">
                    <span className="h-1.5 w-12 rounded-full bg-red-800" />
                    <h2 className="font-serif text-3xl text-slate-900 md:text-4xl">
                      {SECTION_TITLES[group]}
                    </h2>
                  </div>

                  <div className="space-y-8">
                    {groupItems.map((item, index) => (
                      <div key={item.id} className="space-y-4">
                        {renderBlock(item, index)}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Opportunities;