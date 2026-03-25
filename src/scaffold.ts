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

  // Make gradlew executable
  const gradlew = path.join(outDir, 'gradlew');
  if (fs.existsSync(gradlew)) {
    fs.chmodSync(gradlew, 0o755);
  }

  return answers.pluginId;
}