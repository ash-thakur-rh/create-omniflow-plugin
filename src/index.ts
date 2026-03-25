#!/usr/bin/env node
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { scaffold, Answers } from './scaffold.js';

function toPascalCase(id: string): string {
  return id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
}

async function main() {
  console.log('');
  p.intro(pc.bgMagenta(pc.white('  create-omniflow-plugin  ')));

  const answers = await p.group(
    {
      pluginId: () =>
        p.text({
          message: 'Plugin ID',
          placeholder: 'my-ingestor',
          validate: v =>
            /^[a-z][a-z0-9-]*$/.test(v)
              ? undefined
              : 'Use lowercase letters, numbers and hyphens only',
        }),

      pluginName: ({ results }) =>
        p.text({
          message: 'Plugin display name',
          initialValue: toPascalCase(results.pluginId ?? '').replace(/([A-Z])/g, ' $1').trim(),
        }),

      description: () =>
        p.text({
          message: 'Description',
          placeholder: 'Ingests ... data into OmniFlow',
        }),

      author: () =>
        p.text({
          message: 'Author',
          placeholder: 'Your Name',
        }),

      javaPackage: ({ results }) =>
        p.text({
          message: 'Java base package',
          initialValue: `io.github.omniflow.plugins.${(results.pluginId ?? '').replace(/-/g, '')}`,
        }),

      ingestorType: ({ results }) =>
        p.text({
          message: 'Ingestor type key  (used in API paths, e.g. /api/ingest/{type})',
          initialValue: results.pluginId,
        }),

      hasUi: () =>
        p.confirm({
          message: 'Include a Next.js micro UI?',
          initialValue: true,
        }),

      omniflowVersion: () =>
        p.text({
          message: 'OmniFlow plugin-api version to depend on',
          initialValue: '1.0.0',
        }),

      apiUrl: () =>
        p.text({
          message: 'OmniFlow API base URL (for local dev)',
          initialValue: 'http://localhost:8080',
        }),
    },
    {
      onCancel: () => {
        p.cancel('Cancelled.');
        process.exit(0);
      },
    },
  );

  const spinner = p.spinner();
  spinner.start('Scaffolding plugin…');

  const outDir = await scaffold(answers as Answers);

  spinner.stop('Done!');

  const hasUi = answers.hasUi as boolean;
  p.note(
    [
      `cd ${outDir}`,
      '',
      '# Build the JAR (includes UI if enabled):',
      `./gradlew jar`,
      '',
      '# Upload to a running OmniFlow backend:',
      `curl -X POST ${answers.apiUrl}/api/plugins/upload \\`,
      `  -b "JSESSIONID=<your-session>" \\`,
      `  -F "file=@build/libs/${answers.pluginId}-1.0.0.jar"`,
      ...(hasUi
        ? ['', '# Dev UI standalone (no JAR needed):', 'cd ui && npm install && npm run dev']
        : []),
    ].join('\n'),
    'Next steps',
  );

  p.outro(pc.green('Plugin scaffolded successfully!'));
}

main().catch(err => {
  console.error(pc.red('Error: ') + String(err));
  process.exit(1);
});