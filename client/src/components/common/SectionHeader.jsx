// src/components/common/SectionHeader.jsx
import { motion } from "framer-motion";

/**
 * `as` exists because on News, Events, Achievements and Programs this is the
 * only heading at the top of the page — rendering it as an h2 left those pages
 * with no h1 at all, which breaks the document outline for screen-reader users
 * who navigate by heading level.
 */
const SectionHeader = ({ title, subtitle, as = "h2" }) => {
  const Heading = motion[as] || motion.h2;

  return (
    <div className="text-center mb-12">
      <Heading
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-3xl md:text-4xl font-bold text-[#A6192E] drop-shadow-sm"
      >
        {title}
      </Heading>

      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-gray-600 mt-2 max-w-2xl mx-auto"
        >
          {subtitle}
        </motion.p>
      )}

      {/* Accent Divider */}
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
        className="relative mx-auto mt-4 h-1 w-24 bg-gradient-to-r from-[#A6192E] via-purple-600 to-[#A6192E] rounded-full"
      >
        {/* Glow Effect */}
        <div className="absolute inset-0 blur-md bg-purple-500/40 rounded-full"></div>
      </motion.div>
    </div>
  );
};

export default SectionHeader;
