import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Basic configuration for stable operation
  experimental: {
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
    // Disable server components minification to avoid bundler issues
    serverComponentsExternalPackages: ['@supabase/supabase-js']
  },
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    domains: ['localhost', 'supabase.co', 'supabase.com'],
  },
  
  // Disable SWC minification to avoid module issues
  swcMinify: false,
  
  // Webpack configuration to handle module resolution
  webpack: (config, { isServer }) => {
    // Fix for module not found errors
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    return config;
  },
};

export default nextConfig;
