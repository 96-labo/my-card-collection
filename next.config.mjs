import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // 開発環境では無効化してエラーを防ぐ
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ここに本来の設定（もしあれば）を書く
};

export default withPWA(nextConfig);