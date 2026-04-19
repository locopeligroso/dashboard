/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/dashboard',
  output: 'standalone',
  experimental: { serverComponentsExternalPackages: ['better-sqlite3'] },
}
export default nextConfig
