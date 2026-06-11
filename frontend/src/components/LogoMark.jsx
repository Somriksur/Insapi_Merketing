import React from "react";
import { getLogoColor, getLogoFilter, getLogoSource, isCustomLogoColor } from "../lib/branding";

/**
 * Renders the organisation logo with an optional color tint applied.
 *
 * The logo (logo.png) has a WHITE background with a colored "IN" mark —
 * there is no alpha/transparency channel.
 *
 * Technique — mix-blend-mode: multiply:
 *   When an <img> is placed over a colored background and has
 *   mix-blend-mode: multiply, every WHITE pixel in the image becomes
 *   fully transparent (white × color = color, visually the bg shows
 *   through), while the dark/colored logo pixels blend with the tint.
 *   Result: only the "IN" mark changes color, the white background
 *   disappears. This requires the PARENT element to have isolation:isolate
 *   so the blend only applies within the component, not to the page behind.
 *
 * For grayscale: plain CSS filter: grayscale(1) on the <img> is sufficient.
 * For no filter: plain <img>, no wrapper needed.
 */
export default function LogoMark({ settings, className = "w-10 h-10", alt = "Insapi Marketing" }) {
  const src = getLogoSource(settings);
  const filter = getLogoFilter(settings);
  const color = getLogoColor(settings);

  // Color tint mode — wrap in a colored box and use multiply blend
  if (isCustomLogoColor(settings)) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        style={{
          backgroundColor: color,
          isolation: "isolate",
          // Keep the wrapper background invisible outside the logo area
          borderRadius: 0,
        }}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
          style={{ mixBlendMode: "multiply" }}
        />
      </span>
    );
  }

  // Grayscale or no-filter mode — plain img with optional CSS filter
  return (
    <img
      src={src}
      alt={alt}
      className={`shrink-0 object-contain ${className}`}
      style={{ filter }}
    />
  );
}
