import { useParams } from "react-router-dom";
import { publicAPI } from "../lib/api.js";
import useDetailData from "../hooks/useDetailData.js";
import DetailPage from "../components/DetailPage.jsx";
import { firstNonEmpty, getPrimitiveDetails } from "../utils/detailFields.js";

export default function AchievementDetail() {
  const { id } = useParams();
  const { item, loading, error } = useDetailData(publicAPI.getAchievementById, id);

  const title = item?.title || "Achievement";
  const image = firstNonEmpty(item?.image_path, item?.banner_path);
  const subtitle = item?.description || "";

  const meta = [
    { label: "Category", value: item?.category || "—" },
    { label: "Published", value: item?.isPublished ? "Yes" : "No" },
  ];

  const additionalFields = getPrimitiveDetails(item, [
    "title",
    "description",
    "category",
    "image_path",
    "banner_path",
    "link",
    "isPublished",
  ]);

  return (
    <DetailPage
      item={item}
      loading={loading}
      error={error}
      backTo="/achievements"
      backLabel="Back to Achievements"
      entityName="Achievement"
      title={title}
      badge="Achievement"
      subtitle={subtitle}
      image={image}
      imageAlt={title}
      meta={meta}
      additionalFields={additionalFields}
    >
      {item?.description && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Achievement details
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