import { useParams } from "react-router-dom";
import { publicAPI } from "../lib/api.js";
import useDetailData from "../hooks/useDetailData.js";
import DetailPage from "../components/DetailPage.jsx";
import { formatDateTime, getPrimitiveDetails, firstNonEmpty } from "../utils/detailFields.js";

export default function NewsDetail() {
  const { id } = useParams();
  const { item, loading, error } = useDetailData(publicAPI.getNewsById, id);

  const title = item?.title || "News";
  const image = firstNonEmpty(item?.image_path, item?.banner_path);
  const subtitle = item?.summary || item?.body || "";

  const meta = [
    { label: "Date", value: formatDateTime(item?.date) },
    { label: "Published", value: item?.isPublished ? "Yes" : "No" },
  ];

  const additionalFields = getPrimitiveDetails(item, ["date", "isPublished", "summary", "body"]);

  return (
    <DetailPage
      item={item}
      loading={loading}
      error={error}
      backTo="/news"
      backLabel="Back to News"
      entityName="News"
      title={title}
      badge="News"
      subtitle={subtitle}
      image={image}
      imageAlt={title}
      meta={meta}
      additionalFields={additionalFields}
    >
      {item?.summary && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Summary</h2>
          <p className="text-gray-700 leading-7 whitespace-pre-line">
            {item.summary}
          </p>
        </div>
      )}

      {item?.body && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Full story</h2>
          <p className="text-gray-700 leading-7 whitespace-pre-line">
            {item.body}
          </p>
        </div>
      )}
    </DetailPage>
  );
}