import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/imsg-report/",
  plugins: [react()],
});
