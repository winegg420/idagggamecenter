import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
const kok = path.resolve(process.env.OLCUM_KOK);
export default defineConfig({ root: kok, base: "/", plugins: [react()], build: { outDir: path.join(kok, "dist"), emptyOutDir: true }, logLevel: "warn" });
