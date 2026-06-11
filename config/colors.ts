// Single source of truth for the Garden Morning Light palette.
// Using a JS constants object avoids CSS variable resolution issues in Tailwind v4.

export const C = {
  // Page surfaces
  bg:         "#ecf3ef",   // pale sage-green wash
  bgHeader:   "#e0ece7",   // slightly deeper for header
  bgCard:     "#ffffff",

  // Text — forest family, warm not cold
  ink:        "#1a2e25",   // deep forest
  inkMid:     "#3d5e52",   // forest-teal mid
  inkSoft:    "#6a8e82",   // muted teal-grey
  inkFaint:   "#9bbdb4",   // very soft hint

  // Borders
  border:     "#c8dfd8",
  borderSoft: "#daeee8",

  // Teal — the hero accent
  teal:       "#3a9e87",
  tealDark:   "#2a7a68",
  tealLight:  "#a6d4c8",
  tealWash:   "#e2f2ee",

  // Warm terracotta — brings the "pleasant" quality
  warm:       "#c4784e",
  warmLight:  "#ecc4a8",
  warmWash:   "#fdf3ec",

  // Phase journey — deep forest → bright morning teal
  phase: ["#1e4a3e", "#2d7a66", "#4aab92", "#80c4ae"] as const,
} as const;
