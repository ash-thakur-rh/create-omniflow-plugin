import type { Answers } from '../scaffold.js';

export function uiTemplates(a: Answers): Record<string, string> {
  return {
    'ui/package.json':          uiPackageJson(a),
    'ui/tsconfig.json':         uiTsConfig(),
    'ui/next.config.ts':        uiNextConfig(a),
    'ui/tailwind.config.ts':    uiTailwindConfig(),
    'ui/postcss.config.mjs':    uiPostcss(),
    'ui/eslint.config.mjs':     uiEslintConfig(),
    'ui/.env.local':            uiEnvLocal(a),
    'ui/app/globals.css':       uiGlobalsCss(),
    'ui/app/layout.tsx':        uiLayout(a),
    'ui/app/page.tsx':          uiPage(a),
    'ui/components/ThemeSync.tsx': uiThemeSync(),
    'ui/lib/api.ts':            uiApi(a),
  };
}

// ── Templates ─────────────────────────────────────────────────────────────────

function uiPackageJson(a: Answers): string {
  return JSON.stringify(
    {
      name: `${a.pluginId}-ui`,
      version: '1.0.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint',
      },
      dependencies: {
        '@omniflow/ui': 'latest',
        next: '16.2.1',
        react: '19.2.4',
        'react-dom': '19.2.4',
        swr: '^2.3.3',
      },
      devDependencies: {
        '@types/node': '^22',
        '@types/react': '19.2.14',
        '@types/react-dom': '19.2.3',
        autoprefixer: '^10.4.21',
        eslint: '^9.39.4',
        'eslint-config-next': '^16.2.1',
        postcss: '^8.5.3',
        tailwindcss: '^3.4.17',
        typescript: '^5',
      },
      overrides: {
        '@types/react': '19.2.14',
        '@types/react-dom': '19.2.3',
      },
    },
    null,
    2,
  ) + '\n';
}

function uiTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./*'] },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    },
    null,
    2,
  ) + '\n';
}

function uiNextConfig(a: Answers): string {
  return `import type { NextConfig } from 'next';

const forJar = process.env.NEXT_BUILD_FOR_JAR === '1';

const config: NextConfig = {
  transpilePackages: ['@omniflow/ui'],
  output: 'export',
  // basePath and assetPrefix match the host's /api/plugins/{id}/ui/** route.
  basePath:    forJar ? '/api/plugins/${a.pluginId}/ui' : '',
  assetPrefix: forJar ? '/api/plugins/${a.pluginId}/ui' : '',
  images: { unoptimized: true },
  trailingSlash: false,
};

export default config;
`;
}

function uiTailwindConfig(): string {
  return `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './node_modules/@omniflow/ui/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
};

export default config;
`;
}

function uiPostcss(): string {
  return `const config = { plugins: { tailwindcss: {}, autoprefixer: {} } };
export default config;
`;
}

function uiEslintConfig(): string {
  return `import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;
`;
}

function uiEnvLocal(a: Answers): string {
  return `# OmniFlow backend URL — used by the UI when running outside the JAR (npm run dev)
NEXT_PUBLIC_API_URL=${a.apiUrl}
`;
}

function uiGlobalsCss(): string {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

html.dark {
  color-scheme: dark;
}

body {
  @apply bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-300;
}
`;
}

function uiLayout(a: Answers): string {
  return `import type { Metadata } from 'next';
import './globals.css';
import ThemeSync from '@/components/ThemeSync';

export const metadata: Metadata = { title: '${a.pluginName} — OmniFlow' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: \`(function(){var p=new URLSearchParams(location.search).get('theme'),t=p||sessionStorage.getItem('omniflow-plugin-theme'),s=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';if(p)sessionStorage.setItem('omniflow-plugin-theme',p);if((t||s)==='dark')document.documentElement.classList.add('dark')})()\` }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <ThemeSync />
        <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-bold text-gray-900 dark:text-slate-100">${a.pluginName}</span>
          <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900 px-2 py-0.5 rounded-full">OmniFlow Plugin</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </body>
    </html>
  );
}
`;
}

function uiPage(a: Answers): string {
  return `'use client';

import useSWR from 'swr';
import { EmptyState, cls } from '@omniflow/ui';
import { fetchRecords, type PluginRecord } from '@/lib/api';

export default function HomePage() {
  const { data: records, isLoading } = useSWR<PluginRecord[]>(
    'records',
    () => fetchRecords(50),
    { refreshInterval: 30_000 },
  );

  if (isLoading) return <p className="text-gray-500 dark:text-slate-500 text-sm">Loading…</p>;
  if (!records?.length) return (
    <EmptyState
      title="No ${a.pluginName} data ingested yet."
      description="POST data to /api/ingest/${a.ingestorType} to get started."
    />
  );

  return (
    <div className="max-w-4xl space-y-6">
      {/* Records table */}
      <div className={\`\${cls.card} p-4\`}>
        <p className={\`\${cls.heading} mb-3\`}>Records</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={cls.table.header}>
                <th className="text-left py-2 px-2">ID</th>
                <th className="text-left py-2 px-2">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className={cls.table.row}>
                  <td className="py-1.5 px-2 font-mono text-gray-500 dark:text-slate-400">{r.id}</td>
                  <td className="py-1.5 px-2 text-gray-500 dark:text-slate-400">
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`;
}

function uiThemeSync(): string {
  return `'use client';

import { useEffect } from 'react';

export default function ThemeSync() {
  useEffect(() => {
    const param  = new URLSearchParams(window.location.search).get('theme');
    const stored = sessionStorage.getItem('omniflow-plugin-theme');
    const theme  = param ?? stored;
    if (param) sessionStorage.setItem('omniflow-plugin-theme', param);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else if (theme === 'light') document.documentElement.classList.remove('dark');
    else document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);
  return null;
}
`;
}

function uiApi(a: Answers): string {
  return `// The OmniFlow backend URL. Defaults to same origin in production (assets
// are served by the OmniFlow host at /api/plugins/${a.pluginId}/ui).
const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(\`\${res.status} \${res.statusText}\`);
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

// Extend PluginFields to match your ingestor's output shape.
export interface PluginFields {
  [key: string]: unknown;
}

export interface PluginRecord {
  id:        string;
  type:      string;
  timestamp: string;
  fields:    PluginFields;
}

// ── API calls ──────────────────────────────────────────────────────────────

export const fetchRecords = (limit = 50) =>
  get<PluginRecord[]>(\`/api/analytics/builds?type=${a.ingestorType}&limit=\${limit}\`);
`;
}