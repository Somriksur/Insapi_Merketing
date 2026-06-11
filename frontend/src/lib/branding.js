import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

export const DEFAULT_LOGO_URL = `${process.env.PUBLIC_URL || ""}/logo.png`;
export const DEFAULT_BRAND_NAME = "Insapi Marketing";

const BrandingContext = createContext({
  branding: {
    name: DEFAULT_BRAND_NAME,
    logo_url: DEFAULT_LOGO_URL,
    logo_filter: "none",
    logo_custom_color: "",
  },
  setBranding: () => {},
});

export function getLogoSource(settings = {}) {
  return settings.logo_url || DEFAULT_LOGO_URL;
}

/**
 * Returns the CSS filter to apply directly to the <img> element.
 * Only used for grayscale (which works fine on any image via filter).
 * Color tinting is handled separately via mix-blend-mode + background color.
 */
export function getLogoFilter(settings = {}) {
  if (settings.logo_filter === "grayscale") return "grayscale(1)";
  return "none";
}

/**
 * Returns a hex color string when a color tint is active, otherwise "".
 * The LogoMark component uses this to set a background-color behind the logo
 * image, combined with mix-blend-mode: multiply on the <img>, so that:
 *   - White areas of the logo become invisible (white * color = color, but
 *     the parent bg shows through visually via multiply)
 *   - The colored "IN" mark blends with the tint color
 * This works perfectly for logos with a white/light background (no alpha needed).
 */
export function getLogoColor(settings = {}) {
  switch (settings.logo_filter) {
    case "blue":   return "#1D4ED8";
    case "red":    return "#DC2626";
    case "green":  return "#059669";
    case "custom": {
      const hex = settings.logo_custom_color || "";
      return /^#[0-9a-f]{6}$/i.test(hex) ? hex : "";
    }
    default: return "";
  }
}

export function isCustomLogoColor(settings = {}) {
  return Boolean(getLogoColor(settings));
}

/** Default brand color used when no filter/color is set. */
export const DEFAULT_BRAND_COLOR = "#1D4ED8";

/**
 * Returns the active brand hex color derived from the logo color setting.
 * Falls back to the default blue when no color filter is active.
 * Use this to tint text, charts, and buttons to match the logo color.
 */
export function getBrandColor(settings = {}) {
  return getLogoColor(settings) || DEFAULT_BRAND_COLOR;
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState({
    name: DEFAULT_BRAND_NAME,
    logo_url: DEFAULT_LOGO_URL,
    logo_filter: "none",
    logo_custom_color: "",
  });

  useEffect(() => {
    let mounted = true;
    api.get("/settings")
      .then((response) => {
        if (mounted) setBranding(response.data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Update --brand (and related) CSS variables on <html> whenever branding
  // changes so that ALL parts of the app — utility classes, inline styles,
  // charts, nav — pick up the new color automatically.
  useEffect(() => {
    const color = getBrandColor(branding);
    const root = document.documentElement;
    root.style.setProperty("--brand", color);
    root.style.setProperty("--brand-color", color);   // alias used in JSX inline styles
    // Derive a slightly lighter hover and a muted/transparent version
    root.style.setProperty("--brand-hover", color);   // close enough; avoids flicker
    root.style.setProperty("--brand-muted", `${color}2e`); // 18% opacity hex suffix
  }, [branding]);

  const value = useMemo(() => ({
    branding,
    setBranding: (next) => {
      // When branding is updated (e.g. after Save in Settings), also push
      // the new color to CSS variables immediately — no extra render needed.
      const resolved = typeof next === "function" ? next(branding) : next;
      const color = getBrandColor(resolved);
      const root = document.documentElement;
      root.style.setProperty("--brand", color);
      root.style.setProperty("--brand-color", color);
      root.style.setProperty("--brand-hover", color);
      root.style.setProperty("--brand-muted", `${color}2e`);
      setBranding(next);
    },
  }), [branding]); // eslint-disable-line react-hooks/exhaustive-deps

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
