import { useParams } from "react-router-dom";
import { publicAPI } from "../lib/api.js";
import useDetailData from "../hooks/useDetailData.js";
import DetailPage from "../components/DetailPage.jsx";
import ResearchBlocks from "../components/ResearchBlocks.jsx";
import { getPrimitiveDetails, firstNonEmpty } from "../utils/detailFields.js";

export default function ResearchDetail() {
  const { id } = useParams();
  const { item, loading, error } = useDetailData(publicAPI.getResearchById, id);

  const title = item?.title || "Research";
  const image = firstNonEmpty(item?.image_path);
  const subtitle = item?.description || "";

  const meta = [
    { label: "Category", value: item?.category || "—" },
    { label: "Display Order", value: item?.display_order ?? "—" },
    { label: "Link", value: item?.link ? "Available" : "—" },
  ];

  const categoryFields =
    item?.category === "Publication"
      ? [
          { label: "Authors", value: item?.authors },
          { label: "Journal", value: item?.journal },
          { label: "Year", value: item?.year },
        ]
      : item?.category === "Project"
      ? [
          { label: "Faculty", value: item?.faculty },
          { label: "Funding Agency", value: item?.funding_agency },
          { label: "Funding Amount", value: item?.funding_amount },
          { label: "Duration", value: item?.duration },
          { label: "PI / Co-PI", value: item?.pi_co_pi },
          { label: "Status", value: item?.status },
        ]
      : item?.category === "Patent"
      ? [
          { label: "Inventors", value: item?.inventors },
          { label: "Application No.", value: item?.application_no },
          { label: "Patent Status", value: item?.patent_status },
        ]
      : item?.category === "Collaboration"
      ? [{ label: "Organization", value: item?.collaboration_org }]
      : [];

  const additionalFields = [
    ...categoryFields.filter((field) => field.value),
    ...getPrimitiveDetails(item, [
      "category",
      "display_order",
      "description",
      "link",
      "image_path",
      "authors",
      "journal",
      "year",
      "faculty",
      "funding_agency",
      "funding_amount",
      "duration",
      "pi_co_pi",
      "status",
      "inventors",
      "application_no",
      "patent_status",
      "collaboration_org",
    ]),
  ];

  return (
    <DetailPage
      item={item}
      loading={loading}
      error={error}
      backTo="/research"
      backLabel="Back to Research"
      entityName="Research"
      title={title}
      badge={item?.category || "Research"}
      subtitle={subtitle}
      image={image}
      imageAlt={title}
      meta={meta}
      additionalFields={additionalFields}
    >
      {item?.content_json && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Research content
          </h2>
          <ResearchBlocks blocks={item.content_json} />
        </div>
      )}

      {!item?.content_json && item?.description && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Description
          </h2>
          <p className="text-gray-700 leading-7 whitespace-pre-line">
            {item.description}
          </p>
        </div>
      )}

      {item?.link && (
        <div className="pt-2">
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-lg bg-[#A6192E] px-4 py-2 text-sm font-semibold text-white"
          >
            Open link
          </a>
        </div>
      )}
    </DetailPage>
  );
}