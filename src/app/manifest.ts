import type { MetadataRoute } from "next";

// Required so the manifest route is emitted at build time under output:"export".
export const dynamic = "force-static";

// Build-time manifest (emits out/manifest.webmanifest and the <link> tag).
// Colors match the globals.css palette: light --background / dark --background.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Health",
    short_name: "Health",
    description: "Family health dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f7",
    theme_color: "#faf9f7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
