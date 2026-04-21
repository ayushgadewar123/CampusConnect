module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.08)",
      },
      backgroundImage: {
        hero: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
      },
    },
  },
  plugins: [],
};