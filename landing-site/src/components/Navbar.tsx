import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useState } from "react";
import Logo from "./Logo";
import { brand } from "../content";

const navLinks = [
  { label: "Our Story", href: "#story" },
  { label: "What We Offer", href: "#offer" },
  { label: "How We Work", href: "#process" },
  { label: "Why Us", href: "#why" },
  { label: "Gallery", href: "#gallery" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const { scrollY } = useScroll();
  const [pastHero, setPastHero] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    setPastHero(y > vh * 0.85);
  });

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div
        className={`flex items-center justify-between px-5 sm:px-8 py-3 transition-colors duration-500 ${
          pastHero ? "bg-ivory/90 backdrop-blur-md shadow-[0_2px_20px_rgba(95,18,18,0.08)]" : "bg-transparent"
        }`}
      >
        {/* Logo */}
        <a href="#top" className="flex items-center gap-3" aria-label={brand.name}>
          <Logo size={pastHero ? 38 : 46} />
          <span
            className={`font-serif font-semibold leading-tight transition-all duration-500 ${
              pastHero ? "text-maroon text-base sm:text-lg" : "text-white text-lg sm:text-xl"
            }`}
            style={{ textShadow: pastHero ? "none" : "0 1px 12px rgba(0,0,0,0.35)" }}
          >
            Mahindra Distributors
          </span>
        </a>

        {/* Desktop links */}
        <nav className="hidden lg:flex items-center gap-7">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`text-sm font-medium tracking-wide transition-colors ${
                pastHero ? "text-maroon-700 hover:text-gold-600" : "text-ivory/90 hover:text-white"
              }`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Shrunk tagline — appears once scrolled past hero */}
        <motion.div
          initial={false}
          animate={{
            opacity: pastHero ? 1 : 0,
            x: pastHero ? 0 : 12,
          }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="hidden md:block"
        >
          <span className="font-serif italic text-gold-700 text-sm sm:text-base">
            {brand.tagline}
          </span>
        </motion.div>
      </div>
    </motion.header>
  );
}
