// src/pages/Achievements.jsx

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import AchievementCard from "../components/AchievementCard.jsx";
import Loading from "../components/Loading.jsx";
import SectionHeader from "../components/common/SectionHeader.jsx";
import PageWrapper from "../components/common/PageWrapper.jsx";
import { publicAPI } from "../lib/api.js";

const Achievements = () => {
  const [category, setCategory] = useState("student"); // ✅ DEFAULT
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAchievements();
  }, [category]);

  const fetchAchievements = async () => {
    try {
      setLoading(true);
      const res = await publicAPI.getAchievements({ category });
      setAchievements(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <section className="container mx-auto px-4 pb-16">

        {/* HEADER */}
        <SectionHeader title="Achievements" />

        {/* 🔥 TABS */}
        <div className="flex justify-center gap-4 mt-8 mb-10">
          {["student", "faculty"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-6 py-2 rounded-full border text-sm font-medium transition-all
                ${
                  category === cat
                    ? "bg-[#A6192E] text-white border-[#A6192E]"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
            >
              {cat === "student" ? "Student Achievements" : "Faculty Achievements"}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        {loading ? (
          <Loading />
        ) : achievements.length > 0 ? (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {achievements.map((a) => (
              <AchievementCard key={a.id} achievement={a} />
            ))}
          </motion.div>
        ) : (
          <p className="text-center text-gray-500 mt-12">
            No achievements found.
          </p>
        )}

      </section>
    </PageWrapper>
  );
};

export default Achievements;