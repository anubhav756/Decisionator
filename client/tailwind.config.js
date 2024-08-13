/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "bg-red-400",
    "bg-red-500",
    "bg-orange-400",
    "bg-orange-500",
    "bg-amber-400",
    "bg-amber-500",
    "bg-lime-400",
    "bg-lime-500",
    "bg-emerald-400",
    "bg-emerald-500",
    "bg-cyan-400",
    "bg-cyan-500",
    "bg-indigo-400",
    "bg-indigo-500",
    "bg-fuchsia-400",
    "bg-fuchsia-500",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
