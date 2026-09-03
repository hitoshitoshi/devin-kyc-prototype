import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/internal/kyc",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
