// src/pages/Facilities.jsx

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Loading from "../components/Loading.jsx";
import PageWrapper from "../components/common/PageWrapper.jsx";
import Pagination from "../components/common/Pagination.jsx";
import { getImageUrl } from "../utils/imageUtils.js";

const Facilities = () => {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const categoryParam = searchParams.get("category") || "Laboratory";
  const [category, setCategory] = useState(categoryParam);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    setCategory(categoryParam);
  }, [categoryParam]);

  useEffect(() => {
    fetchFacilities();
  }, [category]);

  const fetchFacilities = async () => {
    try {
      setLoading(true);

      const response = await axios.get("/api/public/facilities", {
        params: { category }, // 🔥 ALWAYS FILTER
      });

      setFacilities(response.data.data || []);
    } catch (error) {
      console.error("Error fetching facilities:", error);
    } finally {
      setLoading(false);
      setCurrentPage(1);
    }
  };

  // ❌ REMOVED "All"
  const categories = [
    "Laboratory",
    "Infrastructure",
    "Equipment",
    "Software",
  ];

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = facilities.slice(indexOfFirst, indexOfLast);

  return (
    <PageWrapper title="Facilities">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-[#A6192E] mb-2">Facilities</h1>
        <div className="h-1 w-24 bg-[#A6192E] mx-auto rounded-full"></div>
      </div>

      {/* CATEGORY TABS */}
      <div className="flex flex-wrap justify-center gap-3 mb-10">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-5 py-2 rounded-full text-sm font-medium border 
              ${
                category === cat
                  ? "bg-[#A6192E] text-white border-[#A6192E]"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : facilities.length > 0 ? (
        <>
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence>
              {currentItems.map((item) => (
                <motion.div
                  key={item.id}
                  className="bg-white rounded-2xl shadow-md border overflow-hidden"
                >
                  {item.image_path && (
                    <img
                      src={getImageUrl(item.image_path)}
                      className="w-full h-48 object-cover"
                    />
                  )}

                  <div className="p-5">
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          <div className="mt-10">
            <Pagination
              currentPage={currentPage}
              totalItems={facilities.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </>
      ) : (
        <div className="text-center text-gray-500 py-10">
          No facilities found.
        </div>
      )}
    </PageWrapper>
  );
};

export default Facilities;