/** @type {import('next').NextConfig} */
const nextConfig = {
  // 使用 standalone 模式，但 Electron 会通过服务器访问
  output: 'standalone',
  distDir: 'dist',
  // 禁用图片优化（Electron 环境不需要）
  images: {
    unoptimized: true,
  },
  // 禁用严格模式以避免开发时的双重渲染
  reactStrictMode: false,
  // 确保在 Electron 环境中正确工作
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '',
  // 禁用开发指示器（去掉右下角的 N 图标）
  devIndicators: false,
}

module.exports = nextConfig

