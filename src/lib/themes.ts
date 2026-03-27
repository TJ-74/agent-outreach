/**
 * Theme color tokens for light and dark modes.
 *
 * These values mirror the CSS custom properties in globals.css.
 * The CSS variables are the source of truth at runtime — this file
 * exists for reference, type safety, and tooling support.
 */

export const lightTheme = {
  // Canvas
  cream: "#F7F5F2",
  "cream-deep": "#EFECE7",
  surface: "#FFFFFF",

  // Charcoal — anchoring darks
  charcoal: "#2D3B45",
  "charcoal-light": "#3D4F5C",
  "charcoal-deep": "#1C272F",

  // Copper — primary accent (brand, stays same across themes)
  copper: "#C2690E",
  "copper-hover": "#A85A0A",
  "copper-light": "#FDF2E5",
  "copper-muted": "#F5DFC4",

  // Sage — secondary accent (brand, stays same across themes)
  sage: "#3B7A6B",
  "sage-light": "#EDF5F3",
  "sage-muted": "#C6DDD7",

  // Semantic
  rose: "#BE3D3D",
  "rose-light": "#FCEAEA",
  amber: "#A16207",
  "amber-light": "#FEF6E0",

  // Text — warm grays
  ink: "#2C2925",
  "ink-mid": "#7A746D",
  "ink-light": "#B3ADA5",
  "ink-faint": "#D4CFC8",

  // Edges
  edge: "#E8E4DF",
  "edge-strong": "#D4CFC8",

  // Shadows
  "shadow-xs": "0 1px 2px rgba(44,41,37,0.04)",
  "shadow-sm": "0 2px 8px rgba(44,41,37,0.05), 0 1px 2px rgba(44,41,37,0.03)",
  "shadow-md": "0 4px 16px rgba(44,41,37,0.07), 0 1px 4px rgba(44,41,37,0.03)",
  "shadow-lg": "0 12px 40px rgba(44,41,37,0.1), 0 2px 8px rgba(44,41,37,0.04)",
  "shadow-copper": "0 4px 14px rgba(194,105,14,0.18)",
} as const;

export const darkTheme = {
  // Canvas
  cream: "#141A1F",
  "cream-deep": "#1B2228",
  surface: "#1F272E",

  // Charcoal — same as light (already dark, used as CTA backgrounds)
  charcoal: "#2D3B45",
  "charcoal-light": "#3D4F5C",
  "charcoal-deep": "#1C272F",

  // Copper — brand accent (hue stays, tint surface becomes dark)
  copper: "#C2690E",
  "copper-hover": "#A85A0A",
  "copper-light": "#2D1E0A",
  "copper-muted": "#3A2510",

  // Sage — brand accent (hue stays, tint surface becomes dark)
  sage: "#3B7A6B",
  "sage-light": "#0D1E1A",
  "sage-muted": "#18302A",

  // Semantic (hues stay, light tints become dark)
  rose: "#BE3D3D",
  "rose-light": "#2D0F0F",
  amber: "#A16207",
  "amber-light": "#2A1E08",

  // Text — inverted for dark backgrounds
  ink: "#EDE9E4",
  "ink-mid": "#9B9690",
  "ink-light": "#6B6660",
  "ink-faint": "#3D3830",

  // Edges
  edge: "#2A3240",
  "edge-strong": "#364050",

  // Shadows — stronger for dark backgrounds
  "shadow-xs": "0 1px 2px rgba(0,0,0,0.2)",
  "shadow-sm": "0 2px 8px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
  "shadow-md": "0 4px 16px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.2)",
  "shadow-lg": "0 12px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.25)",
  "shadow-copper": "0 4px 14px rgba(194,105,14,0.25)",
} as const;

export type ThemeTokens = typeof lightTheme;
export type Theme = "light" | "dark";
