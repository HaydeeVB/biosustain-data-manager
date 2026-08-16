/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://biosustain-saas-683265952295.us-central1.run.app',
  },
};

module.exports = nextConfig;