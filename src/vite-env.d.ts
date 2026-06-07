/// <reference types="vite/client" />

// PostHog env vars. Populated at build time by vite.config.ts via `loadEnv`
// + `define`. The `as string` casts let undefined-env behave like empty
// string (Vite injects the empty string when the var is missing), and the
// `string` type matches what `posthog.init` expects for these args.
interface ImportMetaEnv {
  readonly VITE_POSTHOG_PROJECT_TOKEN: string;
  readonly VITE_POSTHOG_HOST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Allow side-effect import of CSS files. The compiler doesn't know about
// Vite's CSS handling, so we declare it.
declare module "*.css";
