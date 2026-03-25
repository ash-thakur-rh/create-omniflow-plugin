import type { Answers } from '../scaffold.js';

function toPascalCase(id: string): string {
  return id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
}

export function javaTemplates(a: Answers): Record<string, string> {
  const className = toPascalCase(a.pluginId);
  const pkgPath   = a.javaPackage.replace(/\./g, '/');

  return {
    // ── Gradle wrapper stub (real wrapper needs `gradle wrapper` to generate) ──
    'gradlew': gradlew(),
    'gradlew.bat': gradlewBat(),
    'settings.gradle': settingsGradle(a),
    'build.gradle': buildGradle(a, className),

    // ── Java sources ──────────────────────────────────────────────────────────
    [`src/main/java/${pkgPath}/${className}Plugin.java`]:   pluginClass(a, className),
    [`src/main/java/${pkgPath}/${className}Ingestor.java`]: ingestorClass(a, className),
  };
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
  implementation 'com.fasterxml.jackson.core:jackson-databind:2.17.2'
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
      'Plugin-Id'     : '${a.pluginId}',
      'Plugin-Version': project.version,
      'Plugin-Class'  : '${a.javaPackage}.${className}Plugin'
    )
  }
}
`;
}

function pluginClass(a: Answers, className: string): string {
  return `package ${a.javaPackage};

import io.github.agnistack.omniflow.pluginapi.*;
import java.util.List;

public class ${className}Plugin implements OmniflowPlugin {

    @Override
    public PluginMetadata metadata() {
        return PluginMetadata.builder()
            .id("${a.pluginId}")
            .name("${a.pluginName}")
            .version("1.0.0")
            .description("${a.description}")
            .author("${a.author}")
            .build();
    }

    @Override
    public List<PluginIngestor<?>> ingestors() {
        return List.of(new ${className}Ingestor());
    }

    @Override
    public List<PluginAction> actions() {
        return List.of();
    }

    @Override
    public boolean hasUi() {
        return ${a.hasUi};
    }

    @Override
    public void onLoad(PluginContext context) {
        // Called when the plugin is loaded — register schemas, etc.
    }

    @Override
    public void onUnload() {
        // Called when the plugin is unloaded — release resources.
    }
}
`;
}

function ingestorClass(a: Answers, className: string): string {
  return `package ${a.javaPackage};

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.agnistack.omniflow.pluginapi.*;
import java.io.InputStream;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public class ${className}Ingestor implements PluginIngestor<PluginDataRecord> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public String getType() {
        return "${a.ingestorType}";
    }

    @Override
    public PluginDataRecord ingest(InputStream data) throws Exception {
        // TODO: parse your data format here
        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = MAPPER.readValue(data, Map.class);

        return PluginDataRecord.builder()
            .id(UUID.randomUUID().toString())
            .type(getType())
            .timestamp(Instant.now())
            .fields(parsed)
            .build();
    }
}
`;
}

function gradlew(): string {
  // Minimal shell wrapper — run `gradle wrapper` inside the project for the real one
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