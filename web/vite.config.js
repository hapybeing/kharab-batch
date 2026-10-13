import { defineConfig } from "vite"; import preact from "@preact/preset-vite";
export default defineConfig({ base: "./", plugins: [preact()], build: { outDir: "../docs", emptyOutDir: true, target: "es2020" }, server: { fs: { allow: [".."] } } });
