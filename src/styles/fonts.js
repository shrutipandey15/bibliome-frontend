// The app's typefaces, self-hosted (DNA card spec, open decision 4).
//
// They used to load from fonts.googleapis.com, which the production CSP
// (default-src 'self', no font-src) blocks — so readers were quietly getting
// Georgia and Helvetica. Bundled from npm, they're served from our own origin,
// cached with the build, and ready for the share card's canvas, which needs the
// real faces to draw with. Each @font-face carries a unicode-range, so a reader
// only downloads the subsets their text uses.
//
// The variable packages register "<Name> Variable" as the family; the CSS
// variables in global.css name both, so either spelling resolves.

// Display serif, with optical sizes (the card's name is set at 168px).
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
// Body sans.
import "@fontsource-variable/dm-sans/opsz.css";
// Labels.
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
// Handwriting accents.
import "@fontsource-variable/caveat/wght.css";
// The display fallback, and the collection chat's own pairing.
import "@fontsource-variable/cormorant-garamond/wght.css";
import "@fontsource-variable/cormorant-garamond/wght-italic.css";
import "@fontsource/spectral/300.css";
import "@fontsource/spectral/400.css";
import "@fontsource/spectral/500.css";
import "@fontsource/spectral/600.css";
import "@fontsource/spectral/300-italic.css";
import "@fontsource/spectral/400-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
