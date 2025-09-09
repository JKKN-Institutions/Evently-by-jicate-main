/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['images.unsplash.com', 'via.placeholder.com'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js', '@supabase/ssr']
  },
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: false,
  // Configure webpack to handle PDF.js properly
  webpack: (config, { isServer }) => {
    // Disable canvas for client-side builds since PDF.js doesn't need it
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    }
    
    return config
  }
}

module.exports = nextConfig