import type { Answers } from '../scaffold.js';

function toPascalCase(id: string): string {
  return id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
}

export function javaTemplates(a: Answers): Record<string, string> {
  const className = toPascalCase(a.pluginId);
  const pkgPath   = a.javaPackage.replace(/\./g, '/');

  const files: Record<string, string> = {
    // ── Gradle wrapper stub (real wrapper needs `gradle wrapper` to generate) ──
    'gradlew': gradlew(),
    'gradlew.bat': gradlewBat(),
    'settings.gradle': settingsGradle(a),
    'build.gradle': buildGradle(a, className),

    // ── Java sources ──────────────────────────────────────────────────────────
    [`src/main/java/${pkgPath}/${className}Plugin.java`]:   pluginClass(a, className),
    [`src/main/java/${pkgPath}/${className}Ingestor.java`]: ingestorClass(a, className),

    // ── ServiceLoader descriptor (required for plugin discovery) ──────────────
    'src/main/resources/META-INF/services/io.github.agnistack.omniflow.pluginapi.OmniflowPlugin':
      `${a.javaPackage}.${className}Plugin\n`,

    // ── CI / ingestor scripts ─────────────────────────────────────────────────
    'scripts/ingest.sh': ingestScript(a),
    'scripts/upload-plugin.sh': uploadPluginScript(a),
  };

  if (a.hasTools) {
    files[`src/main/java/${pkgPath}/tools/${className}QueryTool.java`] = toolClass(a, className);
  }

  if (a.hasAction) {
    files[`src/main/java/${pkgPath}/${className}WebhookAction.java`] = actionClass(a, className);
  }

  return files;
}

// ── Templates ─────────────────────────────────────────────────────────────────

function settingsGradle(a: Answers): string {
  return `rootProject.name = '${a.pluginId}'\n`;
}

function buildGradle(a: Answers, className: string): string {
  const uiBlock = a.hasUi ? `
import com.github.gradle.node.npm.task.NpmTask

node {
  version        = '22.14.0'
  npmVersion     = '10.9.2'
  download       = true
  nodeProjectDir = file("\${projectDir}/ui")
}

def uiOutDir      = file("\${projectDir}/ui/out")
def uiResourceDir = file("\${projectDir}/src/main/resources/static-ui")
def skipUi        = { project.hasProperty('skipUi') }

tasks.named('nodeSetup')  { onlyIf { !skipUi() } }
tasks.named('npmSetup')   { onlyIf { !skipUi() } }
tasks.named('npmInstall') { onlyIf { !skipUi() } }

tasks.register('buildUi', NpmTask) {
  dependsOn tasks.named('npmInstall')
  onlyIf { !skipUi() }
  args        = ['run', 'build']
  environment = ['NEXT_BUILD_FOR_JAR': '1']
  inputs.dir("\${projectDir}/ui/app")
  inputs.dir("\${projectDir}/ui/components")
  inputs.dir("\${projectDir}/ui/lib")
  inputs.file("\${projectDir}/ui/next.config.ts")
  outputs.dir(uiOutDir)
}

tasks.register('copyUiAssets', Copy) {
  dependsOn tasks.named('buildUi')
  onlyIf { !skipUi() }
  from uiOutDir
  into uiResourceDir
}

processResources.dependsOn tasks.named('copyUiAssets')

clean {
  delete uiResourceDir
}
` : '';

  const plugins = a.hasUi
    ? `  id 'java'\n  id 'com.github.node-gradle.node' version '7.1.0'`
    : `  id 'java'`;

  return `${a.hasUi ? "import com.github.gradle.node.npm.task.NpmTask\n\n" : ""}plugins {
${plugins}
}

group   = 'io.github.omniflow.plugins'
version = '1.0.0'
description = '${a.description}'

java {
  toolchain {
    languageVersion = JavaLanguageVersion.of(25)
  }
}

repositories {
  mavenCentral()
  mavenLocal()
}

dependencies {
  compileOnly 'io.github.agnistack:omniflow-plugin-api:${a.omniflowVersion}'
  implementation 'com.fasterxml.jackson.core:jackson-databind:2.21.2'
}
${uiBlock}
jar {
  archiveBaseName = '${a.pluginId}'
  from {
    configurations.runtimeClasspath.collect { it.isDirectory() ? it : zipTree(it) }
  }
  duplicatesStrategy = DuplicatesStrategy.EXCLUDE
  manifest {
    attributes(
      'Plugin-Id'             : '${a.pluginId}',
      'Plugin-Version'        : project.version,
      'Plugin-Api-Version'    : '${a.omniflowVersion}',
      'Plugin-Class'          : '${a.javaPackage}.${className}Plugin',
      'Implementation-Version': project.version
    )
  }
}
`;
}

function pluginClass(a: Answers, className: string): string {
  const toolImport = a.hasTools ? `\nimport ${a.javaPackage}.tools.${className}QueryTool;` : '';
  const toolsMethod = a.hasTools ? `
    private PluginContext ctx;

    @Override
    public List<PluginTool> tools() {
        return List.of(new ${className}QueryTool(ctx));
    }
` : '';

  const actionsMethod = a.hasAction ? `
    @Override
    public List<PluginAction> actions() {
        return List.of(new ${className}WebhookAction());
    }
` : '';

  const onLoadBody = a.hasTools
    ? `        this.ctx = ctx;\n        ctx.log("${a.pluginName} plugin loaded -> ingestor type: ${a.ingestorType}");`
    : `        ctx.log("${a.pluginName} plugin loaded -> ingestor type: ${a.ingestorType}");`;

  const onUnload = a.hasTools ? `
    @Override
    public void onUnload() {
        this.ctx = null;
    }
` : '';

  return `package ${a.javaPackage};

import io.github.agnistack.omniflow.pluginapi.*;
import java.util.List;${toolImport}

public class ${className}Plugin implements OmniflowPlugin {
${toolsMethod}
    @Override
    public PluginMetadata metadata() {
        return new PluginMetadata(
            "${a.pluginId}",
            "${a.pluginName}",
            PluginMetadata.resolveVersion(${className}Plugin.class, "1.0.0"),
            "${a.description}",
            "${a.author}");
    }

    @Override
    public List<PluginIngestor<?>> ingestors() {
        return List.of(new ${className}Ingestor());
    }
${actionsMethod}
    @Override
    public boolean hasUi() {
        return ${a.hasUi};
    }

    @Override
    public void onLoad(PluginContext ctx) {
${onLoadBody}
    }
${onUnload}}
`;
}

function ingestorClass(a: Answers, className: string): string {
  return `package ${a.javaPackage};

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.agnistack.omniflow.pluginapi.*;
import java.io.InputStream;
import java.util.Map;

public class ${className}Ingestor implements PluginIngestor<SimplePluginDataRecord> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public String getType() {
        return "${a.ingestorType}";
    }

    @Override
    public SimplePluginDataRecord ingest(InputStream data) throws Exception {
        // TODO: parse your data format here
        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = MAPPER.readValue(data, Map.class);

        return SimplePluginDataRecord.of(getType(), parsed);
    }
}
`;
}

function toolClass(a: Answers, className: string): string {
  return `package ${a.javaPackage}.tools;

import io.github.agnistack.omniflow.pluginapi.PluginContext;
import io.github.agnistack.omniflow.pluginapi.PluginTool;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * AI tool: {@code query-records}
 * Namespaced by the host as {@code ${a.pluginId}__query-records}.
 *
 * Returns recently ingested records, optionally filtered by a field value.
 * The OmniFlow AI agent can call this tool to answer user questions about
 * the data ingested by this plugin.
 */
public class ${className}QueryTool implements PluginTool {

    private final PluginContext ctx;

    public ${className}QueryTool(PluginContext ctx) {
        this.ctx = ctx;
    }

    @Override
    public String getName() {
        return "query-records";
    }

    @Override
    public String getDescription() {
        return "Query recently ingested ${a.pluginName} records. "
             + "Returns the most recent records, optionally limited by count.";
    }

    @Override
    public String getInputSchema() {
        return """
                {
                  "type": "object",
                  "properties": {
                    "limit": {
                      "type": "integer",
                      "description": "Maximum number of results to return (1-50, default 10)"
                    }
                  }
                }""";
    }

    @Override
    public String execute(Map<String, Object> args) throws Exception {
        int limit = args.get("limit") instanceof Number n ? n.intValue() : 10;
        limit = Math.max(1, Math.min(limit, 50));

        Instant since = Instant.now().minus(90, ChronoUnit.DAYS);
        List<Map<String, Object>> records = ctx.queryRecords("${a.ingestorType}", limit, since);

        if (records.isEmpty()) {
            return "No ${a.pluginName} records found.";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("Found ").append(records.size()).append(" record(s):\\n\\n");

        for (Map<String, Object> rec : records) {
            sb.append("- id=").append(rec.get("id"))
              .append(" timestamp=").append(rec.get("timestamp"))
              .append(" fields=").append(rec)
              .append("\\n");
        }

        return sb.toString();
    }
}
`;
}

function actionClass(a: Answers, className: string): string {
  return `package ${a.javaPackage};

import io.github.agnistack.omniflow.pluginapi.PluginAction;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

/**
 * Webhook action: {@code ${a.pluginId}-notify}
 *
 * Posts a JSON payload to a webhook URL when dispatched from an OmniFlow script.
 * Set the {@code ${a.pluginId.toUpperCase().replace(/-/g, '_')}_WEBHOOK_URL} environment variable
 * to your Slack / Teams / custom webhook endpoint.
 *
 * Usage from an OmniFlow script:
 * <pre>
 *   context.dispatch("${a.pluginId}-notify", "Title", "Message", metadata)
 * </pre>
 */
public class ${className}WebhookAction implements PluginAction {

    private static final String ENV_KEY = "${a.pluginId.toUpperCase().replace(/-/g, '_')}_WEBHOOK_URL";

    @Override
    public String getType() {
        return "${a.pluginId}-notify";
    }

    @Override
    public boolean isConfigured() {
        return System.getenv(ENV_KEY) != null;
    }

    @Override
    public void execute(String title, String message, Map<String, String> metadata) throws Exception {
        String url = System.getenv(ENV_KEY);
        if (url == null || url.isBlank()) {
            throw new IllegalStateException(ENV_KEY + " is not set");
        }

        String payload = String.format(
            "{\\"text\\": \\"*%s*\\\\n%s\\"}", title.replace("\\"", "\\\\\\""), message.replace("\\"", "\\\\\\""));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build();

        HttpClient.newHttpClient()
            .send(request, HttpResponse.BodyHandlers.ofString());
    }
}
`;
}

function gradlew(): string {
  return `#!/bin/sh
# Run: gradle wrapper  — to generate the real Gradle wrapper files
# Or install Gradle and run: gradle <task>
exec gradle "$@"
`;
}

function gradlewBat(): string {
  return `@rem Run: gradle wrapper  — to generate the real Gradle wrapper files
@rem Or install Gradle and run: gradle <task>
@gradle %*
`;
}

function ingestScript(a: Answers): string {
  return `#!/usr/bin/env bash
# Ingest a JSON file into OmniFlow as type "${a.ingestorType}".
#
# Usage:
#   ./scripts/ingest.sh data.json
#   ./scripts/ingest.sh data.json https://omniflow.example.com
#
# Set OMNIFLOW_API_KEY in your environment or CI secrets.

set -euo pipefail

FILE=\${1:?Usage: $0 <data.json> [api-url]}
API_URL=\${2:-${a.apiUrl}}
API_KEY=\${OMNIFLOW_API_KEY:?Set OMNIFLOW_API_KEY environment variable}

echo "Ingesting \${FILE} as type '${a.ingestorType}'..."

HTTP_STATUS=$(curl -s -o /tmp/ingest_response.json -w "%{http_code}" \\
  -X POST "\${API_URL}/api/v1/ingest/${a.ingestorType}" \\
  -H "X-Api-Key: \${API_KEY}" \\
  -H "Content-Type: application/json" \\
  --data-binary "@\${FILE}")

if [ "\${HTTP_STATUS}" -ge 200 ] && [ "\${HTTP_STATUS}" -lt 300 ]; then
  echo "Success (\${HTTP_STATUS}):"
  cat /tmp/ingest_response.json
else
  echo "Failed (\${HTTP_STATUS}):"
  cat /tmp/ingest_response.json
  exit 1
fi
`;
}

function uploadPluginScript(a: Answers): string {
  return `#!/usr/bin/env bash
# Build and upload the plugin JAR to a running OmniFlow backend.
#
# Usage:
#   ./scripts/upload-plugin.sh
#   ./scripts/upload-plugin.sh https://omniflow.example.com
#
# Set OMNIFLOW_API_KEY in your environment or CI secrets.

set -euo pipefail

API_URL=\${1:-${a.apiUrl}}
API_KEY=\${OMNIFLOW_API_KEY:?Set OMNIFLOW_API_KEY environment variable}
JAR="build/libs/${a.pluginId}-1.0.0.jar"

echo "Building JAR..."
./gradlew jar

echo "Uploading \${JAR} to \${API_URL}..."

HTTP_STATUS=$(curl -s -o /tmp/upload_response.json -w "%{http_code}" \\
  -X POST "\${API_URL}/api/v1/plugins/upload" \\
  -H "X-Api-Key: \${API_KEY}" \\
  -F "file=@\${JAR}")

if [ "\${HTTP_STATUS}" -ge 200 ] && [ "\${HTTP_STATUS}" -lt 300 ]; then
  echo "Plugin uploaded successfully (\${HTTP_STATUS}):"
  cat /tmp/upload_response.json
else
  echo "Upload failed (\${HTTP_STATUS}):"
  cat /tmp/upload_response.json
  exit 1
fi
`;
}
