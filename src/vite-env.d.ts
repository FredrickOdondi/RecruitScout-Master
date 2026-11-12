/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_PLUNK_SECRET_KEY?: string;
  readonly VITE_PLUNK_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
