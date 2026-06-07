import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AppleSiliconTable from "./AppleSiliconTable";
import posthog from "posthog-js";
import { PostHogProvider } from "@posthog/react";

posthog.init(import.meta.env.VITE_POSTHOG_PROJECT_TOKEN, {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  defaults: "2026-01-30",
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element not found in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <AppleSiliconTable />
    </PostHogProvider>
  </StrictMode>
);
