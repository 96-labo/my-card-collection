import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'トレカ図鑑 App',
    short_name: 'トレカ図鑑',
    description: '自分のトレカコレクションを管理するアプリ',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/images/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/images/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/images/apple-touch-icon.png', // iPhone用を明示
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}