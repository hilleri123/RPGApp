/** @type {import('next').NextConfig} */

const APP_ORIGIN = process.env.APP_ORIGIN ?? 'http://app:8000'


const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Решает проблему со статикой
    largePageDataBytes: 128 * 100000, // 128KB
  },
  // Для production-сборки
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  
  // Добавьте для решения проблемы с путями
  assetPrefix: process.env.NODE_ENV === 'production' ? '/_next' : '',
  
  // Решает проблему с шрифтами
  // optimizeFonts: true,
  // fontLoaders: [
  //   { loader: '@next/font/google', options: { subsets: ['latin'] } }
  // ],
  
  // Настройки для Docker
  distDir: '.next',
  generateBuildId: async () => 'build-id',

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://app:8000/api/:path*' },
    ]
  },


  webpack: (config, { isServer }) => {
    if (isServer) {
      // Excalidraw — только клиент, исключаем из серверного бандла
      config.resolve.alias['@excalidraw/excalidraw'] = false;
    }
    return config;
  },
  // Если используешь transpilePackages:
  transpilePackages: ['@excalidraw/excalidraw'],
}

export default nextConfig
