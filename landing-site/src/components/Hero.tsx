import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import { brand } from "../content";
import SareeDollFigure from "./SareeDollFigure";

const taglineWords = brand.tagline.split(" ");

export default function Hero() {
  const reduceMotion = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll progress through the (tall) hero section — drives the scroll-linked doll animation.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Hero content fades + lifts out as you complete the scroll (so navbar tagline can take over).
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const contentLift = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const taglineScale = useTransform(scrollYProgress, [0, 0.6], [1, 0.78]);

  // Mobile detection for a lighter animation
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;

  return (
    <section
      id="top"
      ref={sectionRef}
      // 200vh gives the scroll-linked animation room to play; inner sticky layer stays pinned.
      className="relative"
      style={{ height: "200vh" }}
      aria-label="Hero — The World of Fabrics"
    >
      {/* Sticky inner viewport */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Background — deep maroon with gold radial vignette */}
        <div
          aria-hidden
          className="absolute inset-0 -z-20"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 25%, #5f1212 0%, #4a0e0e 45%, #2e0808 100%)",
          }}
        />
        {/* Subtle gold filigree rings */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-30"
          style={{
            background:
              "radial-gradient(closest-side, transparent 58%, rgba(168,125,24,0.35) 60%, transparent 62%), radial-gradient(closest-side, transparent 70%, rgba(168,125,24,0.18) 72%, transparent 74%)",
            backgroundSize: "70% 70%, 90% 90%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />

        {/* Center figure */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <SareeDollFigure scrollProgress={scrollYProgress} mobile={isMobile} />
        </div>

        {/* Tagline + subheading (fades on scroll out) */}
        <motion.div
          style={{ opacity: contentOpacity, y: contentLift }}
          className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center"
        >
          <motion.h1
            style={{ scale: taglineScale }}
            className="font-serif font-semibold leading-[1.05] text-ivory text-5xl sm:text-7xl md:text-8xl tracking-tight"
            aria-label={brand.tagline}
          >
            {taglineWords.map((word, i) => (
              <span key={i} className="inline-block overflow-hidden align-bottom mx-[0.18em]">
                <motion.span
                  initial={reduceMotion ? { opacity: 0 } : { y: "110%", opacity: 0 }}
                  animate={reduceMotion ? { opacity: 1 } : { y: "0%", opacity: 1 }}
                  transition={{
                    duration: 0.75,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.35 + i * 0.14,
                  }}
                  className="inline-block gpu-layer"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, #fdf9ec 0%, #efe3bd 60%, #dcb44a 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    textShadow: "0 6px 40px rgba(168,125,24,0.25)",
                  }}
                >
                  {word}
                </motion.span>
              </span>
            ))}
          </motion.h1>

          <motion.p
            initial={reduceMotion ? { opacity: 0 } : { y: 18, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            transition={{ duration: 0.9, ease: "easeOut", delay: 0.35 + taglineWords.length * 0.14 + 0.15 }}
            className="mt-6 max-w-xl text-ivory/85 font-sans text-base sm:text-lg md:text-xl font-light tracking-wide"
          >
            {brand.subheading}
          </motion.p>
        </motion.div>

        {/* Scroll-to-explore indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
          style={{ opacity: contentOpacity }}
          className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 text-ivory/70"
        >
          <span className="text-[11px] uppercase tracking-[0.25em] font-light">Scroll to explore</span>
          <motion.span
            animate={reduceMotion ? {} : { y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="block"
          >
            <ChevronDown className="h-5 w-5 text-gold-300" />
          </motion.span>
        </motion.div>
      </div>
    </section>
  );
}
