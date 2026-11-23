import { useState, useEffect, useRef } from "react";
import { getImageUrl } from "../utils/imageUtils";

const Slider = ({ slides = [] }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!slides.length || paused) return;
    timerRef.current = setInterval(
      () => setCurrentSlide((prev) => (prev + 1) % slides.length),
      5000
    );
    return () => clearInterval(timerRef.current);
  }, [slides.length, paused]);

  const goToPrevious = () =>
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  const goToNext = () =>
    setCurrentSlide((prev) => (prev + 1) % slides.length);

  if (!slides || slides.length === 0) return null;

  return (
    <div
      className="relative w-screen h-[85vh] overflow-hidden group z-0 -mx-[calc((100vw-100%)/2)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      /* Also pause on focus: the carousel advances every 5s, and a keyboard
         user tabbing through the dots would otherwise have the slide change
         underneath them (WCAG 2.2.2, Pause/Stop/Hide). */
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Department highlights"
    >
      {/* Slides */}
      {slides.map((slide, index) => (
        <div
          key={slide.id || index}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentSlide ? "opacity-100" : "opacity-0"
          }`}
        >
          <img
            src={getImageUrl(slide.image_path)}
            alt={slide.caption || `Slide ${index + 1}`}
            className="w-full h-full object-cover object-center"
          />
        </div>
      ))}

      {/* Prev Button. focus:opacity-100 matters — without it a keyboard user
          focuses a control that is still fully transparent. */}
      <button
        type="button"
        onClick={goToPrevious}
        aria-label="Previous slide"
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10"
      >
        <svg
          aria-hidden="true"
          className="w-6 h-6 text-gray-800"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      {/* Next Button */}
      <button
        type="button"
        onClick={goToNext}
        aria-label="Next slide"
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10"
      >
        <svg
          aria-hidden="true"
          className="w-6 h-6 text-gray-800"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {/* Dots */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10"
        role="group"
        aria-label="Choose slide"
      >
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setCurrentSlide(index)}
            /* These render as bare coloured pills with no text content, so
               without an explicit name a screen reader announces only
               "button" four times over. */
            aria-label={`Go to slide ${index + 1} of ${slides.length}`}
            aria-current={index === currentSlide ? "true" : undefined}
            className={`h-2.5 rounded-full transition-all ${
              index === currentSlide ? "bg-white w-8" : "bg-white/60 w-2.5"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default Slider;
