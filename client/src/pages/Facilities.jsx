// src/pages/Facilities.jsx

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Loading from "../components/Loading.jsx";
import PageWrapper from "../components/common/PageWrapper.jsx";
import Pagination from "../components/common/Pagination.jsx";
import { getImageUrl } from "../utils/imageUtils.js";

const MotionLink = motion(Link);

const categories = [
  "Laboratory",
  "Infrastructure",
  "Equipment",
  "Software",
];

const Facilities = () => {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);

  const category = searchParams.get("category") || "Laboratory";
  const itemsPerPage = 6;

  useEffect(() => {
    fetchFacilities(category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const fetchFacilities = async (selectedCategory) => {
    try {
      setLoading(true);

      const response = await axios.get("/api/public/facilities", {
        params: selectedCategory ? { category: selectedCategory } : {},
      });

      setFacilities(response.data.data || []);
    } catch (error) {
      console.error("Error fetching facilities:", error);
      setFacilities([]);
    } finally {
      setLoading(false);
      setCurrentPage(1);
    }
  };

  const handleCategoryChange = (cat) => {
    setSearchParams({ category: cat });
  };

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = facilities.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.max(1, Math.ceil(facilities.length / itemsPerPage));

  return (
    <PageWrapper title="Facilities">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 rounded-3xl border border-[#A6192E]/15 bg-gradient-to-br from-white to-[#A6192E]/5 px-6 py-8 shadow-sm md:px-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-[#A6192E]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#A6192E]">
                Department Facilities
              </span>
              <h1 className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
                Facilities
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 md:text-base">
                Explore the department&apos;s laboratories, infrastructure,
                equipment, and software resources.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm md:min-w-[320px]">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Category
                </div>
                <div className="mt-1 font-semibold text-gray-900">
                  {category}
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Items
                </div>
                <div className="mt-1 font-semibold text-gray-900">
                  {facilities.length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CATEGORY TABS */}
        <div className="mb-10 flex flex-wrap justify-center gap-3">
          {categories.map((cat) => {
            const active = category === cat;

            return (
              <motion.button
                key={cat}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleCategoryChange(cat)}
                className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "border-[#A6192E] bg-[#A6192E] text-white shadow-md"
                    : "border-gray-300 bg-white text-gray-700 hover:border-[#A6192E]/40 hover:bg-[#A6192E]/5"
                }`}
              >
                {cat}
              </motion.button>
            );
          })}
        </div>

        {loading ? (
          <Loading />
        ) : facilities.length > 0 ? (
          <>
            <motion.div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {currentItems.map((item) => (
                  <MotionLink
                    key={item.id}
                    to={`/facilities/${item.id}`}
                    whileHover={{ y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    className="group flex h-full flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-xl"
                  >
                    <div className="relative h-52 overflow-hidden bg-gray-100">
                      {item.image_path ? (
                        <img
                          src={getImageUrl(item.image_path)}
                          alt={item.name || "Facility"}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                          <div className="text-center">
                            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                              🏛️
                            </div>
                            <p className="text-sm font-medium text-gray-500">
                              No image available
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="absolute left-4 top-4">
                        <span className="inline-flex rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                          {item.category || category}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="text-xl font-semibold text-gray-900 transition-colors group-hover:text-[#A6192E]">
                        {item.name}
                      </h3>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">
                        {item.description || "No description available."}
                      </p>

                      <div className="mt-5 space-y-2 text-sm text-gray-700">
                        {item.location && (
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-[#A6192E]">•</span>
                            <span>
                              <span className="font-semibold">Location:</span>{" "}
                              {item.location}
                            </span>
                          </div>
                        )}

                        {item.in_charge && (
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-[#A6192E]">•</span>
                            <span>
                              <span className="font-semibold">In-charge:</span>{" "}
                              {item.in_charge}
                            </span>
                          </div>
                        )}

                        {item.capacity && (
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-[#A6192E]">•</span>
                            <span>
                              <span className="font-semibold">Capacity:</span>{" "}
                              {item.capacity}
                            </span>
                          </div>
                        )}
                      </div>

                      {item.specifications && (
                        <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Specifications
                          </div>
                          <p className="mt-2 line-clamp-3 leading-6">
                            {item.specifications}
                          </p>
                        </div>
                      )}

                      <div className="mt-6 flex items-center justify-between border-t pt-4">
                        <span className="text-sm font-semibold text-[#A6192E]">
                          View details
                        </span>
                        <span className="text-lg text-[#A6192E] transition-transform duration-200 group-hover:translate-x-1">
                          →
                        </span>
                      </div>
                    </div>
                  </MotionLink>
                ))}
              </AnimatePresence>
            </motion.div>

            <div className="mt-10">
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-500 shadow-sm">
            No facilities found in this category.
          </div>
        )}
      </div>
    </PageWrapper>
  );
};

export default Facilities;