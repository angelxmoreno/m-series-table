import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // Vite exposes `import.meta.env.VITE_*` for env vars it has loaded, but we
  // want the PostHog values guaranteed to reach the bundle even if the loader
  // skips them. Pull them out with loadEnv and re-inject as build-time literals.
  const env = loadEnv(mode, process.cwd(), "");
  console.log("[build] VITE_POSTHOG_* in env:", Object.keys(env).filter(k => k.startsWith("VITE_POSTHOG")));

  return {
    base: "/",
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.VITE_POSTHOG_PROJECT_TOKEN": JSON.stringify(
        env.VITE_POSTHOG_PROJECT_TOKEN
      ),
      "import.meta.env.VITE_POSTHOG_HOST": JSON.stringify(env.VITE_POSTHOG_HOST),
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.js",
    },
  };
});
