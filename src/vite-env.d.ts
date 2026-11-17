/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  // ভবিষ্যতে যদি Firebase বা Supabase এর কোনো env ভেরিয়েবল থাকে, সেগুলো এখানে অ্যাড করতে পারবেন
  // readonly VITE_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Allows TypeScript to understand '?raw' imports for markdown files
declare module '*?raw' {
  const content: string;
  export default content;
}
