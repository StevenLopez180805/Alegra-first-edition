/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_MAX_ORDER_ITEMS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
