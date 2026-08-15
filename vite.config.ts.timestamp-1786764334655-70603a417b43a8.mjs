// vite.config.ts
import { defineConfig, loadEnv } from "file:///Users/fredrickodondi/Desktop/recruitscout/node_modules/vite/dist/node/index.js";
import react from "file:///Users/fredrickodondi/Desktop/recruitscout/node_modules/@vitejs/plugin-react/dist/index.js";
import { crx } from "file:///Users/fredrickodondi/Desktop/recruitscout/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// vite.manifest.config.ts
import { defineManifest } from "file:///Users/fredrickodondi/Desktop/recruitscout/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// package.json
var package_default = {
  name: "recruitscout-chrome-extension",
  version: "1.0.0",
  description: "Production-ready Chrome Extension for extracting job listing data from any job board website",
  type: "module",
  scripts: {
    dev: "vite",
    build: "tsc && vite build",
    "build:dashboard": "tsc && vite build -c vite.dashboard.config.ts",
    "build:blue": "tsc && vite build -c vite.blue.config.ts",
    preview: "vite preview",
    lint: "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    test: "vitest",
    "test:coverage": "vitest --coverage",
    "generate-icons": "node scripts/generate-icons.js"
  },
  dependencies: {
    "@google/genai": "^2.8.0",
    "@langchain/core": "^1.1.48",
    "@langchain/google-genai": "^2.1.31",
    "@langchain/langgraph": "^1.3.4",
    "@langchain/openai": "^1.4.7",
    "@pinecone-database/pinecone": "^7.2.0",
    "@supabase/supabase-js": "^2.107.0",
    clsx: "^2.1.0",
    openai: "^6.41.0",
    react: "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^10.1.0",
    recharts: "^3.10.1",
    "tailwind-merge": "^2.2.0",
    zod: "^4.4.3"
  },
  devDependencies: {
    "@crxjs/vite-plugin": "^2.0.0-beta.23",
    "@types/chrome": "^0.0.259",
    "@types/node": "^20.11.5",
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@typescript-eslint/eslint-plugin": "^6.19.1",
    "@typescript-eslint/parser": "^6.19.1",
    "@vitejs/plugin-react": "^4.2.1",
    autoprefixer: "^10.4.17",
    eslint: "^8.56.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    postcss: "^8.4.33",
    tailwindcss: "^3.4.1",
    typescript: "^5.3.3",
    vite: "^5.0.12",
    vitest: "^1.2.1"
  }
};

// vite.manifest.config.ts
var vite_manifest_config_default = defineManifest({
  manifest_version: 3,
  name: "RecruitScout - Job Data Extractor",
  version: package_default.version,
  description: "Extract job listing data from any job board website with a single click. Supports LinkedIn, Indeed, Glassdoor, and 20+ other platforms.",
  permissions: [
    "storage",
    "activeTab",
    "tabs",
    "scripting",
    "offscreen",
    "alarms",
    "identity"
  ],
  host_permissions: [
    "https://www.linkedin.com/*",
    "*://*.indeed.com/*",
    "*://*.indeed.it/*",
    "*://*.indeed.co.uk/*",
    "*://*.trovolavoro.com/*",
    "*://*.trovolavoro.it/*",
    "https://www.glassdoor.com/*",
    "https://www.monster.com/*",
    "https://www.ziprecruiter.com/*",
    "https://www.careerbuilder.com/*",
    "https://www.simplyhired.com/*",
    "https://www.jobs.net/*",
    "https://www.jobrapido.com/*",
    "https://www.neuvoo.com/*",
    "https://www.snagajob.com/*",
    "https://www.dice.com/*",
    "https://www.guru.com/*",
    "https://www.upwork.com/*",
    "https://www.freelancer.com/*",
    "https://jobs.careers.microsoft.com/*",
    "https://careers.google.com/*",
    "https://careers.apple.com/*",
    "https://jobs.netflix.com/*",
    "https://www.amazon.jobs/*",
    "http://localhost:5173/*",
    "http://72.60.215.34/*",
    "https://gmail.googleapis.com/*",
    "https://accounts.google.com/*"
  ],
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: [
        "https://www.linkedin.com/*",
        "*://*.indeed.com/*",
        "*://*.indeed.it/*",
        "*://*.indeed.co.uk/*",
        "*://*.trovolavoro.com/*",
        "*://*.trovolavoro.it/*",
        "https://www.glassdoor.com/*",
        "https://www.monster.com/*",
        "https://www.ziprecruiter.com/*",
        "https://www.careerbuilder.com/*",
        "https://www.simplyhired.com/*",
        "https://www.jobs.net/*",
        "https://www.jobrapido.com/*",
        "https://www.neuvoo.com/*",
        "https://www.snagajob.com/*",
        "https://www.dice.com/*",
        "https://www.guru.com/*",
        "https://www.upwork.com/*",
        "https://www.freelancer.com/*",
        "https://jobs.careers.microsoft.com/*",
        "https://careers.google.com/*",
        "https://careers.apple.com/*",
        "https://jobs.netflix.com/*",
        "https://www.amazon.jobs/*",
        "http://localhost:5173/*",
        "http://72.60.215.34/*"
      ],
      js: ["src/content/index.ts"],
      run_at: "document_end"
    }
  ],
  action: {
    default_popup: "src/popup/index.html",
    default_icon: {
      "16": "public/icons/icon-16.png",
      "32": "public/icons/icon-32.png",
      "48": "public/icons/icon-48.png",
      "128": "public/icons/icon-128.png"
    }
  },
  icons: {
    "16": "public/icons/icon-16.png",
    "32": "public/icons/icon-32.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png"
  },
  web_accessible_resources: [
    {
      resources: ["public/icons/*"],
      matches: ["<all_urls>"]
    }
  ],
  offscreen: {
    document: "src/offscreen/index.html",
    persistent: false
  },
  oauth2: {
    client_id: "241480604524-gjgd1n67qn80rjtjkum7ik39k0n4ea2j.apps.googleusercontent.com",
    scopes: ["https://www.googleapis.com/auth/gmail.send"]
  },
  options_page: "src/dashboard/index.html"
});

// vite.config.ts
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    define: {
      "import.meta.env.VITE_OPENAI_API_KEY": JSON.stringify(env.VITE_OPENAI_API_KEY),
      "import.meta.env.VITE_PINECONE_API_KEY": JSON.stringify(env.VITE_PINECONE_API_KEY),
      "import.meta.env.VITE_PINECONE_INDEX": JSON.stringify(env.VITE_PINECONE_INDEX)
    },
    plugins: [
      react(),
      crx({ manifest: vite_manifest_config_default })
    ],
    base: "./",
    build: {
      outDir: "dist",
      rollupOptions: {
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js",
          assetFileNames: "[name].[ext]"
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAidml0ZS5tYW5pZmVzdC5jb25maWcudHMiLCAicGFja2FnZS5qc29uIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL2ZyZWRyaWNrb2RvbmRpL0Rlc2t0b3AvcmVjcnVpdHNjb3V0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvZnJlZHJpY2tvZG9uZGkvRGVza3RvcC9yZWNydWl0c2NvdXQvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2ZyZWRyaWNrb2RvbmRpL0Rlc2t0b3AvcmVjcnVpdHNjb3V0L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHsgY3J4IH0gZnJvbSAnQGNyeGpzL3ZpdGUtcGx1Z2luJztcbmltcG9ydCBtYW5pZmVzdCBmcm9tICcuL3ZpdGUubWFuaWZlc3QuY29uZmlnJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKTtcbiAgXG4gIHJldHVybiB7XG4gICAgZGVmaW5lOiB7XG4gICAgICAnaW1wb3J0Lm1ldGEuZW52LlZJVEVfT1BFTkFJX0FQSV9LRVknOiBKU09OLnN0cmluZ2lmeShlbnYuVklURV9PUEVOQUlfQVBJX0tFWSksXG4gICAgICAnaW1wb3J0Lm1ldGEuZW52LlZJVEVfUElORUNPTkVfQVBJX0tFWSc6IEpTT04uc3RyaW5naWZ5KGVudi5WSVRFX1BJTkVDT05FX0FQSV9LRVkpLFxuICAgICAgJ2ltcG9ydC5tZXRhLmVudi5WSVRFX1BJTkVDT05FX0lOREVYJzogSlNPTi5zdHJpbmdpZnkoZW52LlZJVEVfUElORUNPTkVfSU5ERVgpLFxuICAgIH0sXG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIGNyeCh7IG1hbmlmZXN0IH0pLFxuICBdLFxuICBiYXNlOiAnLi8nLFxuICBidWlsZDoge1xuICAgIG91dERpcjogJ2Rpc3QnLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBlbnRyeUZpbGVOYW1lczogJ1tuYW1lXS5qcycsXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnW25hbWVdLmpzJyxcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6ICdbbmFtZV0uW2V4dF0nXG4gICAgICB9XG4gICAgfVxuICB9XG4gIH07XG59KTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL2ZyZWRyaWNrb2RvbmRpL0Rlc2t0b3AvcmVjcnVpdHNjb3V0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvZnJlZHJpY2tvZG9uZGkvRGVza3RvcC9yZWNydWl0c2NvdXQvdml0ZS5tYW5pZmVzdC5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2ZyZWRyaWNrb2RvbmRpL0Rlc2t0b3AvcmVjcnVpdHNjb3V0L3ZpdGUubWFuaWZlc3QuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lTWFuaWZlc3QgfSBmcm9tICdAY3J4anMvdml0ZS1wbHVnaW4nO1xuaW1wb3J0IHBhY2thZ2VKc29uIGZyb20gJy4vcGFja2FnZS5qc29uJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lTWFuaWZlc3Qoe1xuICBtYW5pZmVzdF92ZXJzaW9uOiAzLFxuICBuYW1lOiAnUmVjcnVpdFNjb3V0IC0gSm9iIERhdGEgRXh0cmFjdG9yJyxcbiAgdmVyc2lvbjogcGFja2FnZUpzb24udmVyc2lvbixcbiAgZGVzY3JpcHRpb246ICdFeHRyYWN0IGpvYiBsaXN0aW5nIGRhdGEgZnJvbSBhbnkgam9iIGJvYXJkIHdlYnNpdGUgd2l0aCBhIHNpbmdsZSBjbGljay4gU3VwcG9ydHMgTGlua2VkSW4sIEluZGVlZCwgR2xhc3Nkb29yLCBhbmQgMjArIG90aGVyIHBsYXRmb3Jtcy4nLFxuICBwZXJtaXNzaW9uczogW1xuICAgICdzdG9yYWdlJyxcbiAgICAnYWN0aXZlVGFiJyxcbiAgICAndGFicycsXG4gICAgJ3NjcmlwdGluZycsXG4gICAgJ29mZnNjcmVlbicsXG4gICAgJ2FsYXJtcycsXG4gICAgJ2lkZW50aXR5J1xuICBdLFxuICBob3N0X3Blcm1pc3Npb25zOiBbXG4gICAgJ2h0dHBzOi8vd3d3LmxpbmtlZGluLmNvbS8qJyxcbiAgICAnKjovLyouaW5kZWVkLmNvbS8qJyxcbiAgICAnKjovLyouaW5kZWVkLml0LyonLFxuICAgICcqOi8vKi5pbmRlZWQuY28udWsvKicsXG4gICAgJyo6Ly8qLnRyb3ZvbGF2b3JvLmNvbS8qJyxcbiAgICAnKjovLyoudHJvdm9sYXZvcm8uaXQvKicsXG4gICAgJ2h0dHBzOi8vd3d3LmdsYXNzZG9vci5jb20vKicsXG4gICAgJ2h0dHBzOi8vd3d3Lm1vbnN0ZXIuY29tLyonLFxuICAgICdodHRwczovL3d3dy56aXByZWNydWl0ZXIuY29tLyonLFxuICAgICdodHRwczovL3d3dy5jYXJlZXJidWlsZGVyLmNvbS8qJyxcbiAgICAnaHR0cHM6Ly93d3cuc2ltcGx5aGlyZWQuY29tLyonLFxuICAgICdodHRwczovL3d3dy5qb2JzLm5ldC8qJyxcbiAgICAnaHR0cHM6Ly93d3cuam9icmFwaWRvLmNvbS8qJyxcbiAgICAnaHR0cHM6Ly93d3cubmV1dm9vLmNvbS8qJyxcbiAgICAnaHR0cHM6Ly93d3cuc25hZ2Fqb2IuY29tLyonLFxuICAgICdodHRwczovL3d3dy5kaWNlLmNvbS8qJyxcbiAgICAnaHR0cHM6Ly93d3cuZ3VydS5jb20vKicsXG4gICAgJ2h0dHBzOi8vd3d3LnVwd29yay5jb20vKicsXG4gICAgJ2h0dHBzOi8vd3d3LmZyZWVsYW5jZXIuY29tLyonLFxuICAgICdodHRwczovL2pvYnMuY2FyZWVycy5taWNyb3NvZnQuY29tLyonLFxuICAgICdodHRwczovL2NhcmVlcnMuZ29vZ2xlLmNvbS8qJyxcbiAgICAnaHR0cHM6Ly9jYXJlZXJzLmFwcGxlLmNvbS8qJyxcbiAgICAnaHR0cHM6Ly9qb2JzLm5ldGZsaXguY29tLyonLFxuICAgICdodHRwczovL3d3dy5hbWF6b24uam9icy8qJyxcbiAgICAnaHR0cDovL2xvY2FsaG9zdDo1MTczLyonLFxuICAgICdodHRwOi8vNzIuNjAuMjE1LjM0LyonLFxuICAgICdodHRwczovL2dtYWlsLmdvb2dsZWFwaXMuY29tLyonLFxuICAgICdodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vKidcbiAgXSxcbiAgYmFja2dyb3VuZDoge1xuICAgIHNlcnZpY2Vfd29ya2VyOiAnc3JjL2JhY2tncm91bmQvc2VydmljZS13b3JrZXIudHMnLFxuICAgIHR5cGU6ICdtb2R1bGUnXG4gIH0sXG4gIGNvbnRlbnRfc2NyaXB0czogW1xuICAgIHtcbiAgICAgIG1hdGNoZXM6IFtcbiAgICAgICAgJ2h0dHBzOi8vd3d3LmxpbmtlZGluLmNvbS8qJyxcbiAgICAgICAgJyo6Ly8qLmluZGVlZC5jb20vKicsXG4gICAgICAgICcqOi8vKi5pbmRlZWQuaXQvKicsXG4gICAgICAgICcqOi8vKi5pbmRlZWQuY28udWsvKicsXG4gICAgICAgICcqOi8vKi50cm92b2xhdm9yby5jb20vKicsXG4gICAgICAgICcqOi8vKi50cm92b2xhdm9yby5pdC8qJyxcbiAgICAgICAgJ2h0dHBzOi8vd3d3LmdsYXNzZG9vci5jb20vKicsXG4gICAgICAgICdodHRwczovL3d3dy5tb25zdGVyLmNvbS8qJyxcbiAgICAgICAgJ2h0dHBzOi8vd3d3LnppcHJlY3J1aXRlci5jb20vKicsXG4gICAgICAgICdodHRwczovL3d3dy5jYXJlZXJidWlsZGVyLmNvbS8qJyxcbiAgICAgICAgJ2h0dHBzOi8vd3d3LnNpbXBseWhpcmVkLmNvbS8qJyxcbiAgICAgICAgJ2h0dHBzOi8vd3d3LmpvYnMubmV0LyonLFxuICAgICAgICAnaHR0cHM6Ly93d3cuam9icmFwaWRvLmNvbS8qJyxcbiAgICAgICAgJ2h0dHBzOi8vd3d3Lm5ldXZvby5jb20vKicsXG4gICAgICAgICdodHRwczovL3d3dy5zbmFnYWpvYi5jb20vKicsXG4gICAgICAgICdodHRwczovL3d3dy5kaWNlLmNvbS8qJyxcbiAgICAgICAgJ2h0dHBzOi8vd3d3Lmd1cnUuY29tLyonLFxuICAgICAgICAnaHR0cHM6Ly93d3cudXB3b3JrLmNvbS8qJyxcbiAgICAgICAgJ2h0dHBzOi8vd3d3LmZyZWVsYW5jZXIuY29tLyonLFxuICAgICAgICAnaHR0cHM6Ly9qb2JzLmNhcmVlcnMubWljcm9zb2Z0LmNvbS8qJyxcbiAgICAgICAgJ2h0dHBzOi8vY2FyZWVycy5nb29nbGUuY29tLyonLFxuICAgICAgICAnaHR0cHM6Ly9jYXJlZXJzLmFwcGxlLmNvbS8qJyxcbiAgICAgICAgJ2h0dHBzOi8vam9icy5uZXRmbGl4LmNvbS8qJyxcbiAgICAgICAgJ2h0dHBzOi8vd3d3LmFtYXpvbi5qb2JzLyonLFxuICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDo1MTczLyonLFxuICAgICAgICAnaHR0cDovLzcyLjYwLjIxNS4zNC8qJ1xuICAgICAgXSxcbiAgICAgIGpzOiBbJ3NyYy9jb250ZW50L2luZGV4LnRzJ10sXG4gICAgICBydW5fYXQ6ICdkb2N1bWVudF9lbmQnXG4gICAgfVxuICBdLFxuICBhY3Rpb246IHtcbiAgICBkZWZhdWx0X3BvcHVwOiAnc3JjL3BvcHVwL2luZGV4Lmh0bWwnLFxuICAgIGRlZmF1bHRfaWNvbjoge1xuICAgICAgJzE2JzogJ3B1YmxpYy9pY29ucy9pY29uLTE2LnBuZycsXG4gICAgICAnMzInOiAncHVibGljL2ljb25zL2ljb24tMzIucG5nJyxcbiAgICAgICc0OCc6ICdwdWJsaWMvaWNvbnMvaWNvbi00OC5wbmcnLFxuICAgICAgJzEyOCc6ICdwdWJsaWMvaWNvbnMvaWNvbi0xMjgucG5nJ1xuICAgIH1cbiAgfSxcbiAgaWNvbnM6IHtcbiAgICAnMTYnOiAncHVibGljL2ljb25zL2ljb24tMTYucG5nJyxcbiAgICAnMzInOiAncHVibGljL2ljb25zL2ljb24tMzIucG5nJyxcbiAgICAnNDgnOiAncHVibGljL2ljb25zL2ljb24tNDgucG5nJyxcbiAgICAnMTI4JzogJ3B1YmxpYy9pY29ucy9pY29uLTEyOC5wbmcnXG4gIH0sXG4gIHdlYl9hY2Nlc3NpYmxlX3Jlc291cmNlczogW1xuICAgIHtcbiAgICAgIHJlc291cmNlczogWydwdWJsaWMvaWNvbnMvKiddLFxuICAgICAgbWF0Y2hlczogWyc8YWxsX3VybHM+J11cbiAgICB9XG4gIF0sXG4gIG9mZnNjcmVlbjoge1xuICAgIGRvY3VtZW50OiAnc3JjL29mZnNjcmVlbi9pbmRleC5odG1sJyxcbiAgICBwZXJzaXN0ZW50OiBmYWxzZVxuICB9LFxuICBvYXV0aDI6IHtcbiAgICBjbGllbnRfaWQ6ICcyNDE0ODA2MDQ1MjQtZ2pnZDFuNjdxbjgwcmp0amt1bTdpazM5azBuNGVhMmouYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20nLFxuICAgIHNjb3BlczogWydodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL2dtYWlsLnNlbmQnXVxuICB9LFxuICBvcHRpb25zX3BhZ2U6ICdzcmMvZGFzaGJvYXJkL2luZGV4Lmh0bWwnXG59KTtcbiIsICJ7XG4gIFwibmFtZVwiOiBcInJlY3J1aXRzY291dC1jaHJvbWUtZXh0ZW5zaW9uXCIsXG4gIFwidmVyc2lvblwiOiBcIjEuMC4wXCIsXG4gIFwiZGVzY3JpcHRpb25cIjogXCJQcm9kdWN0aW9uLXJlYWR5IENocm9tZSBFeHRlbnNpb24gZm9yIGV4dHJhY3Rpbmcgam9iIGxpc3RpbmcgZGF0YSBmcm9tIGFueSBqb2IgYm9hcmQgd2Vic2l0ZVwiLFxuICBcInR5cGVcIjogXCJtb2R1bGVcIixcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcImRldlwiOiBcInZpdGVcIixcbiAgICBcImJ1aWxkXCI6IFwidHNjICYmIHZpdGUgYnVpbGRcIixcbiAgICBcImJ1aWxkOmRhc2hib2FyZFwiOiBcInRzYyAmJiB2aXRlIGJ1aWxkIC1jIHZpdGUuZGFzaGJvYXJkLmNvbmZpZy50c1wiLFxuICAgIFwiYnVpbGQ6Ymx1ZVwiOiBcInRzYyAmJiB2aXRlIGJ1aWxkIC1jIHZpdGUuYmx1ZS5jb25maWcudHNcIixcbiAgICBcInByZXZpZXdcIjogXCJ2aXRlIHByZXZpZXdcIixcbiAgICBcImxpbnRcIjogXCJlc2xpbnQgLiAtLWV4dCB0cyx0c3ggLS1yZXBvcnQtdW51c2VkLWRpc2FibGUtZGlyZWN0aXZlcyAtLW1heC13YXJuaW5ncyAwXCIsXG4gICAgXCJ0ZXN0XCI6IFwidml0ZXN0XCIsXG4gICAgXCJ0ZXN0OmNvdmVyYWdlXCI6IFwidml0ZXN0IC0tY292ZXJhZ2VcIixcbiAgICBcImdlbmVyYXRlLWljb25zXCI6IFwibm9kZSBzY3JpcHRzL2dlbmVyYXRlLWljb25zLmpzXCJcbiAgfSxcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiQGdvb2dsZS9nZW5haVwiOiBcIl4yLjguMFwiLFxuICAgIFwiQGxhbmdjaGFpbi9jb3JlXCI6IFwiXjEuMS40OFwiLFxuICAgIFwiQGxhbmdjaGFpbi9nb29nbGUtZ2VuYWlcIjogXCJeMi4xLjMxXCIsXG4gICAgXCJAbGFuZ2NoYWluL2xhbmdncmFwaFwiOiBcIl4xLjMuNFwiLFxuICAgIFwiQGxhbmdjaGFpbi9vcGVuYWlcIjogXCJeMS40LjdcIixcbiAgICBcIkBwaW5lY29uZS1kYXRhYmFzZS9waW5lY29uZVwiOiBcIl43LjIuMFwiLFxuICAgIFwiQHN1cGFiYXNlL3N1cGFiYXNlLWpzXCI6IFwiXjIuMTA3LjBcIixcbiAgICBcImNsc3hcIjogXCJeMi4xLjBcIixcbiAgICBcIm9wZW5haVwiOiBcIl42LjQxLjBcIixcbiAgICBcInJlYWN0XCI6IFwiXjE4LjMuMVwiLFxuICAgIFwicmVhY3QtZG9tXCI6IFwiXjE4LjMuMVwiLFxuICAgIFwicmVhY3QtbWFya2Rvd25cIjogXCJeMTAuMS4wXCIsXG4gICAgXCJyZWNoYXJ0c1wiOiBcIl4zLjEwLjFcIixcbiAgICBcInRhaWx3aW5kLW1lcmdlXCI6IFwiXjIuMi4wXCIsXG4gICAgXCJ6b2RcIjogXCJeNC40LjNcIlxuICB9LFxuICBcImRldkRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJAY3J4anMvdml0ZS1wbHVnaW5cIjogXCJeMi4wLjAtYmV0YS4yM1wiLFxuICAgIFwiQHR5cGVzL2Nocm9tZVwiOiBcIl4wLjAuMjU5XCIsXG4gICAgXCJAdHlwZXMvbm9kZVwiOiBcIl4yMC4xMS41XCIsXG4gICAgXCJAdHlwZXMvcmVhY3RcIjogXCJeMTguMi40OFwiLFxuICAgIFwiQHR5cGVzL3JlYWN0LWRvbVwiOiBcIl4xOC4yLjE4XCIsXG4gICAgXCJAdHlwZXNjcmlwdC1lc2xpbnQvZXNsaW50LXBsdWdpblwiOiBcIl42LjE5LjFcIixcbiAgICBcIkB0eXBlc2NyaXB0LWVzbGludC9wYXJzZXJcIjogXCJeNi4xOS4xXCIsXG4gICAgXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiOiBcIl40LjIuMVwiLFxuICAgIFwiYXV0b3ByZWZpeGVyXCI6IFwiXjEwLjQuMTdcIixcbiAgICBcImVzbGludFwiOiBcIl44LjU2LjBcIixcbiAgICBcImVzbGludC1wbHVnaW4tcmVhY3QtaG9va3NcIjogXCJeNC42LjBcIixcbiAgICBcImVzbGludC1wbHVnaW4tcmVhY3QtcmVmcmVzaFwiOiBcIl4wLjQuNVwiLFxuICAgIFwicG9zdGNzc1wiOiBcIl44LjQuMzNcIixcbiAgICBcInRhaWx3aW5kY3NzXCI6IFwiXjMuNC4xXCIsXG4gICAgXCJ0eXBlc2NyaXB0XCI6IFwiXjUuMy4zXCIsXG4gICAgXCJ2aXRlXCI6IFwiXjUuMC4xMlwiLFxuICAgIFwidml0ZXN0XCI6IFwiXjEuMi4xXCJcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFnVCxTQUFTLGNBQWMsZUFBZTtBQUN0VixPQUFPLFdBQVc7QUFDbEIsU0FBUyxXQUFXOzs7QUNGOFMsU0FBUyxzQkFBc0I7OztBQ0FqVztBQUFBLEVBQ0UsTUFBUTtBQUFBLEVBQ1IsU0FBVztBQUFBLEVBQ1gsYUFBZTtBQUFBLEVBQ2YsTUFBUTtBQUFBLEVBQ1IsU0FBVztBQUFBLElBQ1QsS0FBTztBQUFBLElBQ1AsT0FBUztBQUFBLElBQ1QsbUJBQW1CO0FBQUEsSUFDbkIsY0FBYztBQUFBLElBQ2QsU0FBVztBQUFBLElBQ1gsTUFBUTtBQUFBLElBQ1IsTUFBUTtBQUFBLElBQ1IsaUJBQWlCO0FBQUEsSUFDakIsa0JBQWtCO0FBQUEsRUFDcEI7QUFBQSxFQUNBLGNBQWdCO0FBQUEsSUFDZCxpQkFBaUI7QUFBQSxJQUNqQixtQkFBbUI7QUFBQSxJQUNuQiwyQkFBMkI7QUFBQSxJQUMzQix3QkFBd0I7QUFBQSxJQUN4QixxQkFBcUI7QUFBQSxJQUNyQiwrQkFBK0I7QUFBQSxJQUMvQix5QkFBeUI7QUFBQSxJQUN6QixNQUFRO0FBQUEsSUFDUixRQUFVO0FBQUEsSUFDVixPQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYixrQkFBa0I7QUFBQSxJQUNsQixVQUFZO0FBQUEsSUFDWixrQkFBa0I7QUFBQSxJQUNsQixLQUFPO0FBQUEsRUFDVDtBQUFBLEVBQ0EsaUJBQW1CO0FBQUEsSUFDakIsc0JBQXNCO0FBQUEsSUFDdEIsaUJBQWlCO0FBQUEsSUFDakIsZUFBZTtBQUFBLElBQ2YsZ0JBQWdCO0FBQUEsSUFDaEIsb0JBQW9CO0FBQUEsSUFDcEIsb0NBQW9DO0FBQUEsSUFDcEMsNkJBQTZCO0FBQUEsSUFDN0Isd0JBQXdCO0FBQUEsSUFDeEIsY0FBZ0I7QUFBQSxJQUNoQixRQUFVO0FBQUEsSUFDViw2QkFBNkI7QUFBQSxJQUM3QiwrQkFBK0I7QUFBQSxJQUMvQixTQUFXO0FBQUEsSUFDWCxhQUFlO0FBQUEsSUFDZixZQUFjO0FBQUEsSUFDZCxNQUFRO0FBQUEsSUFDUixRQUFVO0FBQUEsRUFDWjtBQUNGOzs7QURqREEsSUFBTywrQkFBUSxlQUFlO0FBQUEsRUFDNUIsa0JBQWtCO0FBQUEsRUFDbEIsTUFBTTtBQUFBLEVBQ04sU0FBUyxnQkFBWTtBQUFBLEVBQ3JCLGFBQWE7QUFBQSxFQUNiLGFBQWE7QUFBQSxJQUNYO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUFBLEVBQ0Esa0JBQWtCO0FBQUEsSUFDaEI7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQUEsRUFDQSxZQUFZO0FBQUEsSUFDVixnQkFBZ0I7QUFBQSxJQUNoQixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsaUJBQWlCO0FBQUEsSUFDZjtBQUFBLE1BQ0UsU0FBUztBQUFBLFFBQ1A7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0EsSUFBSSxDQUFDLHNCQUFzQjtBQUFBLE1BQzNCLFFBQVE7QUFBQSxJQUNWO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sZUFBZTtBQUFBLElBQ2YsY0FBYztBQUFBLE1BQ1osTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsRUFDVDtBQUFBLEVBQ0EsMEJBQTBCO0FBQUEsSUFDeEI7QUFBQSxNQUNFLFdBQVcsQ0FBQyxnQkFBZ0I7QUFBQSxNQUM1QixTQUFTLENBQUMsWUFBWTtBQUFBLElBQ3hCO0FBQUEsRUFDRjtBQUFBLEVBQ0EsV0FBVztBQUFBLElBQ1QsVUFBVTtBQUFBLElBQ1YsWUFBWTtBQUFBLEVBQ2Q7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLFdBQVc7QUFBQSxJQUNYLFFBQVEsQ0FBQyw0Q0FBNEM7QUFBQSxFQUN2RDtBQUFBLEVBQ0EsY0FBYztBQUNoQixDQUFDOzs7QUQ5R0QsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDeEMsUUFBTSxNQUFNLFFBQVEsTUFBTSxRQUFRLElBQUksR0FBRyxFQUFFO0FBRTNDLFNBQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxNQUNOLHVDQUF1QyxLQUFLLFVBQVUsSUFBSSxtQkFBbUI7QUFBQSxNQUM3RSx5Q0FBeUMsS0FBSyxVQUFVLElBQUkscUJBQXFCO0FBQUEsTUFDakYsdUNBQXVDLEtBQUssVUFBVSxJQUFJLG1CQUFtQjtBQUFBLElBQy9FO0FBQUEsSUFDRixTQUFTO0FBQUEsTUFDUCxNQUFNO0FBQUEsTUFDTixJQUFJLEVBQUUsdUNBQVMsQ0FBQztBQUFBLElBQ2xCO0FBQUEsSUFDQSxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUixlQUFlO0FBQUEsUUFDYixRQUFRO0FBQUEsVUFDTixnQkFBZ0I7QUFBQSxVQUNoQixnQkFBZ0I7QUFBQSxVQUNoQixnQkFBZ0I7QUFBQSxRQUNsQjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDQTtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
