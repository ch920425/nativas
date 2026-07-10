/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRANSPORT?: "fixture" | "live";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
