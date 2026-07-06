import { brand } from "../content";

// Octagonal "MD" mark. When `brand.logoSrc` is set (user uploads the real logo),
// this component falls back to the image instead of the SVG placeholder.
export default function Logo({ size = 44 }: { size?: number }) {
  if (brand.logoSrc) {
    return (
      <img
        src={brand.logoSrc}
        alt={`${brand.name} logo`}
        width={size}
        height={size}
        className="object-contain"
        style={{ height: size }}
      />
    );
  }

  // Octagon path (regular octagon inscribed in viewBox 0..100)
  const octagon = "M29,3 H71 L97,29 V71 L71,97 H29 L3,71 V29 Z";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${brand.name} logo`}
      className="block"
    >
      <path d={octagon} fill="#ffffff" stroke="#5f1212" strokeWidth="3" />
      <path d={octagon} fill="none" stroke="#a87d18" strokeWidth="1" opacity="0.6" transform="scale(0.92) translate(4.3,4.3)" />
      <text
        x="50"
        y="54"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Cormorant Garamond', Georgia, serif"
        fontSize="34"
        fontWeight="700"
        fill="#5f1212"
        letterSpacing="-1"
      >
        MD
      </text>
    </svg>
  );
}
