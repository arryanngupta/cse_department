import { useParams } from "react-router-dom";
import { publicAPI } from "../lib/api.js";
import useDetailData from "../hooks/useDetailData.js";
import DetailPage from "../components/DetailPage.jsx";
import { formatDateTime, getPrimitiveDetails, firstNonEmpty } from "../utils/detailFields.js";

export default function EventDetail() {
  const { id } = useParams();
  const { item, loading, error } = useDetailData(publicAPI.getEventById, id);

  const title = item?.title || "Event";
  const image = firstNonEmpty(item?.banner_path, item?.image_path);
  const subtitle = item?.description || "";

  const meta = [
    { label: "Starts", value: formatDateTime(item?.startsAt) },
    { label: "Ends", value: formatDateTime(item?.endsAt) },
    { label: "Venue", value: item?.venue || "—" },
    { label: "Published", value: item?.isPublished ? "Yes" : "No" },
  ];

  const additionalFields = getPrimitiveDetails(item, [
    "startsAt",
    "endsAt",
    "venue",
    "isPublished",
  ]);

  return (
    <DetailPage
      item={item}
      loading={loading}
      error={error}
      backTo="/events"
      backLabel="Back to Events"
      entityName="Event"
      title={title}
      badge="Event"
      subtitle={subtitle}
      image={image}
      imageAlt={title}
      meta={meta}
      additionalFields={additionalFields}
    >
      {item?.description && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">About this event</h2>
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
            Open event link
          </a>
        </div>
      )}
    </DetailPage>
  );
}