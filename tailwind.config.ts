import type { Config } from "tailwindcss";

const config: Config = {
  // コンテンツの対象範囲（ここが重要！）
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // --- ここに「震える」アニメーションを追加 ---
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0) rotate(0deg)' },
          '25%': { transform: 'translateX(-4px) rotate(-2deg)' },
          '50%': { transform: 'translateX(4px) rotate(2deg)' },
          '75%': { transform: 'translateX(-4px) rotate(-1deg)' },
        }
      },
      animation: {
        shake: 'shake 0.1s ease-in-out infinite',
      },
      // ----------------------------------------
    },
  },
  plugins: [require("tailwindcss-animate")], // Shadcn UIを使っているなら必須
};

export default config;