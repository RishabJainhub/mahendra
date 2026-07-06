import { motion, useReducedMotion, useTransform, useScroll, type MotionValue } from "framer-motion";
import { useRef } from "react";

// GPU-only animated properties: transform (rotateY, scale, translateY) + opacity.
// No width/height/top/left are animated. Reversible automatically because
// useTransform derives directly from scroll progress.

interface FigureProps {
  scrollProgress: MotionValue<number>; // 0..1 progress through hero
  mobile?: boolean;
}

function Pallu({ progress, reduceMotion }: { progress: MotionValue<number>; reduceMotion: boolean }) {
  // The pallu (drape over the left shoulder) unfurls from the shoulder downward.
  const scaleY = reduceMotion ? 1 : useTransform(progress, [0.05, 0.75], [0, 1]);
  const opacity = reduceMotion ? 1 : useTransform(progress, [0.05, 0.4], [0, 1]);
  const flutter = useTransform(progress, [0.4, 1], [0, 8]);
  const flutterY = useTransform(flutter, (v) => `${v}px`);

  return (
    <motion.g
      style={{
        scaleY,
        opacity,
        transformOrigin: "260px 200px",
        y: reduceMotion ? 0 : flutterY,
      }}
      className="gpu-layer"
    >
      {/* Pallu flowing from left shoulder down across the body */}
      <path
        d="M250,195 Q220,260 210,340 Q205,400 225,460 Q240,500 270,510 L300,510 Q280,470 272,420 Q268,360 282,300 Q292,250 300,210 Z"
        fill="#8f1f1f"
        stroke="#a87d18"
        strokeWidth="2"
      />
      {/* Gold zari border on the pallu edge */}
      <path
        d="M250,195 Q220,260 210,340 Q205,400 225,460 Q240,500 270,510"
        fill="none"
        stroke="#dcb44a"
        strokeWidth="3"
        strokeDasharray="6 3"
      />
      {/* Decorative motif on pallu */}
      <circle cx="240" cy="320" r="6" fill="#dcb44a" opacity="0.85" />
      <circle cx="245" cy="380" r="5" fill="#dcb44a" opacity="0.7" />
      <circle cx="250" cy="440" r="4" fill="#dcb44a" opacity="0.6" />
    </motion.g>
  );
}

export default function SareeDollFigure({ scrollProgress, mobile = false }: FigureProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const innerRef = useRef<HTMLDivElement>(null);

  // Rotation: full figure rotates subtly (mobile: smaller range)
  const maxRotate = mobile ? 8 : 18;
  const rotateY = reduceMotion ? 0 : useTransform(scrollProgress, [0, 1], [0, maxRotate]);
  const rotateZ = reduceMotion ? 0 : useTransform(scrollProgress, [0, 1], [0, mobile ? 2 : 4]);
  const figureScale = reduceMotion ? 1 : useTransform(scrollProgress, [0, 1], [0.92, 1.02]);

  // Subtle parallax lift as you scroll
  const lift = reduceMotion ? 0 : useTransform(scrollProgress, [0, 1], [0, mobile ? -10 : -24]);

  // Glow opacity ramps in early for cinematic feel
  const glowOpacity = reduceMotion ? 0.5 : useTransform(scrollProgress, [0, 0.4], [0.15, 0.55]);

  return (
    <div
      ref={innerRef}
      className="relative flex items-center justify-center gpu-layer"
      style={{ perspective: 1200 }}
    >
      {/* Radial glow */}
      <motion.div
        aria-hidden
        style={{ opacity: glowOpacity }}
        className="absolute inset-0 -z-10"
      >
        <div
          className="w-full h-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(168,125,24,0.45), rgba(95,18,18,0.18) 60%, transparent 75%)",
          }}
        />
      </motion.div>

      <motion.div
        style={{
          rotateY,
          rotateZ,
          scale: figureScale,
          y: lift,
          transformStyle: "preserve-3d",
        }}
        className="gpu-layer"
      >
        <svg
          viewBox="0 0 500 720"
          width={mobile ? 280 : 420}
          height={mobile ? 403 : 605}
          role="img"
          aria-label="Illustration of a doll draped in a saree, unfurling as you scroll"
          className="block drop-shadow-[0_30px_60px_rgba(46,8,8,0.35)]"
        >
          <defs>
            <linearGradient id="sareeBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7a1818" />
              <stop offset="100%" stopColor="#4a0e0e" />
            </linearGradient>
            <linearGradient id="blouse" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a87d18" />
              <stop offset="100%" stopColor="#5e4410" />
            </linearGradient>
            <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f3d9b8" />
              <stop offset="100%" stopColor="#e3c08e" />
            </linearGradient>
            <radialGradient id="cheek" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e29a9a" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#e29a9a" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Saree skirt / lehenga flare */}
          <path
            d="M180,400 Q170,520 150,650 L350,650 Q330,520 320,400 Z"
            fill="url(#sareeBody)"
          />
          {/* Gold zari border at hem */}
          <path
            d="M150,635 Q250,645 350,635 L350,650 Q250,660 150,650 Z"
            fill="#a87d18"
          />
          <path
            d="M150,635 Q250,645 350,635"
            fill="none"
            stroke="#dcb44a"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
          {/* Vertical decorative streaks on skirt */}
          <g stroke="#dcb44a" strokeWidth="1.2" opacity="0.45" fill="none">
            <path d="M210,420 Q208,520 200,630" />
            <path d="M250,420 Q250,520 250,630" />
            <path d="M290,420 Q292,520 300,630" />
          </g>

          {/* Waistband */}
          <rect x="195" y="390" width="110" height="14" rx="3" fill="#a87d18" />
          <line x1="195" y1="397" x2="305" y2="397" stroke="#dcb44a" strokeWidth="1" strokeDasharray="3 3" />

          {/* Blouse / torso */}
          <path d="M205,235 Q200,300 200,395 L300,395 Q300,300 295,235 Q280,215 250,212 Q220,215 205,235 Z" fill="url(#blouse)" />
          <path d="M205,235 Q200,300 200,395 L300,395 Q300,300 295,235 Q280,215 250,212 Q220,215 205,235 Z" fill="none" stroke="#dcb44a" strokeWidth="1.5" />
          {/* Blouse neckline */}
          <path d="M225,225 Q250,250 275,225" fill="none" stroke="#5e4410" strokeWidth="2" />

          {/* Arms (simple, holding pallu side) */}
          <path d="M205,255 Q175,300 165,360 Q160,395 175,400 Q190,395 200,360 Q205,310 215,275 Z" fill="url(#skin)" />
          <path d="M295,255 Q325,300 335,360 Q340,395 325,400 Q310,395 300,360 Q295,310 285,275 Z" fill="url(#skin)" />

          {/* Neck */}
          <rect x="240" y="200" width="20" height="20" fill="url(#skin)" />

          {/* Head */}
          <ellipse cx="250" cy="160" rx="42" ry="50" fill="url(#skin)" />
          <ellipse cx="225" cy="170" rx="10" ry="14" fill="url(#cheek)" />
          <ellipse cx="275" cy="170" rx="10" ry="14" fill="url(#cheek)" />

          {/* Hair — back bun + front parting */}
          <path d="M210,140 Q210,90 250,85 Q290,90 290,140 Q290,165 280,150 Q270,130 250,128 Q230,130 220,150 Q210,165 210,140 Z" fill="#2e0808" />
          <circle cx="250" cy="100" r="22" fill="#2e0808" />
          {/* Hair parting line (gold sindoor-style) */}
          <line x1="250" y1="115" x2="250" y2="138" stroke="#a87d18" strokeWidth="1.5" opacity="0.6" />

          {/* Eyes (closed, serene) */}
          <path d="M228,160 Q235,164 242,160" fill="none" stroke="#2e0808" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M258,160 Q265,164 272,160" fill="none" stroke="#2e0808" strokeWidth="1.8" strokeLinecap="round" />
          {/* Lips */}
          <path d="M243,182 Q250,186 257,182 Q250,190 243,182 Z" fill="#b93838" />
          {/* Nose */}
          <path d="M250,164 L247,176 Q250,178 253,176 Z" fill="none" stroke="#5e4410" strokeWidth="1" />

          {/* Jewelry — earrings + bindi + necklace */}
          <circle cx="210" cy="165" r="3" fill="#dcb44a" />
          <circle cx="290" cy="165" r="3" fill="#dcb44a" />
          <circle cx="250" cy="148" r="2.5" fill="#b93838" />
          <path d="M232,200 Q250,212 268,200" fill="none" stroke="#dcb44a" strokeWidth="1.5" />
          <circle cx="250" cy="207" r="3" fill="#dcb44a" />

          {/* Pallu (animated) — drawn over the shoulder */}
          <Pallu progress={scrollProgress} reduceMotion={reduceMotion} />
        </svg>
      </motion.div>
    </div>
  );
}
