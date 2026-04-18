import { useParams } from "react-router-dom";
import { publicAPI } from "../lib/api.js";
import useDetailData from "../hooks/useDetailData.js";
import DetailPage from "../components/DetailPage.jsx";
import { firstNonEmpty, getPrimitiveDetails } from "../utils/detailFields.js";

export default function FacilityDetail() {
  const { id } = useParams();
  const { item, loading, error } = useDetailData(publicAPI.getFacilityById, id);

  const title = item?.title || item?.name || "Facility";
  const image = firstNonEmpty(item?.image_path, item?.banner_path, item?.photo_path);
  const subtitle = item?.description || item?.summary || "";

  const meta = [
    { label: "Category", value: item?.category || "—" },
    { label: "Status", value: item?.status || item?.is_active ? "Active" : "—" },
  ];

  const additionalFields = getPrimitiveDetails(item, [
    "title",
    "name",
    "description",
    "summary",
    "category",
    "status",
    "is_active",
    "image_path",
    "banner_path",
    "photo_path",
    "content_json",
  ]);

  return (
    <DetailPage
      item={item}
      loading={loading}
      error={error}
      backTo="/facilities"
      backLabel="Back to Facilities"
      entityName="Facility"
      title={title}
      badge="Facility"
      subtitle={subtitle}
      image={image}
      imageAlt={title}
      meta={meta}
      additionalFields={additionalFields}
    >
      {item?.description && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            About this facility
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