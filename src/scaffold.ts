import fs from 'node:fs';
import path from 'node:path';
import { javaTemplates } from './templates/java.js';
import { uiTemplates } from './templates/ui.js';

export interface Answers {
  pluginId: string;
  pluginName: string;
  description: string;
  author: string;
  javaPackage: string;
  ingestorType: string;
  hasTools: boolean;
  hasAction: boolean;
  hasUi: boolean;
  omniflowVersion: string;
  apiUrl: string;
}

export async function scaffold(answers: Answers): Promise<string> {
  const outDir = path.resolve(process.cwd(), answers.pluginId);

  const files = javaTemplates(answers);
  if (answers.hasUi) {
    Object.assign(files, uiTemplates(answers));
  }

  for (const [relPath, content] of Object.entries(files)) {
    const abs = path.join(outDir, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }

  // Make shell scripts executable
  for (const script of ['gradlew', 'scripts/ingest.sh', 'scripts/upload-plugin.sh']) {
    const abs = path.join(outDir, script);
    if (fs.existsSync(abs)) fs.chmodSync(abs, 0o755);
  }

  return answers.pluginId;
}