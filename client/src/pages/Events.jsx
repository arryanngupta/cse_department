// src/pages/Events.jsx

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EventCard from "../components/EventCard.jsx";
import Loading from "../components/Loading.jsx";
import SectionHeader from "../components/common/SectionHeader.jsx";
import PageWrapper from "../components/common/PageWrapper.jsx";
import { publicAPI } from "../lib/api.js";

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const limit = 6;

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line
  }, [page]);

  const fetchEvents = async () => {
    try {
      setLoading(true);

      const res = await publicAPI.getEvents({
        page,
        limit,
      });

      // 🔥 Already sorted from backend (DESC)
      setEvents(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch events", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <PageWrapper>
      <section className="container mx-auto px-4 py-16">

        {/* ✅ SINGLE HEADING */}
        <SectionHeader title="Events" />

        {/* ✅ ALL EVENTS IN ONE LIST */}
        {events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            {events.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="block"
              >
                <EventCard event={event} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-10">
            No events available.
          </div>
        )}

        {/* PAGINATION */}
        <div className="flex justify-center items-center gap-4 mt-16">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 border rounded disabled:opacity-40"
          >
            Prev
          </button>

          <span className="px-4 py-2 bg-[#8B0000] text-white rounded">
            {page}
          </span>

          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 border rounded"
          >
            Next
          </button>
        </div>

      </section>
    </PageWrapper>
  );
};

export default Events;