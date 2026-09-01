import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The whole page is static — no server work at request time, so it deploys
  // as plain HTML/CSS/JS with no functions behind it.
  output: "export",
};

export default nextConfig;
