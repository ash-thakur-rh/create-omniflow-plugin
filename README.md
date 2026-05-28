# create-omniflow-plugin

Interactive CLI scaffolder for [OmniFlow](https://github.com/agnistack/omniflow) plugins.

Generates a ready-to-build Gradle project with a Java ingestor, optional AI tools (exposed to OmniFlow AI chat), optional webhook action, optional Next.js micro UI, and all the wiring needed to upload the plugin as a JAR to a running OmniFlow backend.

## Usage

Run directly with `npx` (no install needed):

```sh
npx create-omniflow-plugin
```

Or with `pnpm`/`yarn`:

```sh
pnpm dlx create-omniflow-plugin
yarn dlx create-omniflow-plugin
```

The CLI will ask a few questions and scaffold a new directory named after your plugin ID.

### Prompts

| Prompt | Description |
|---|---|
| Plugin ID | Lowercase, hyphen-separated identifier (e.g. `gradle-build-scan`) |
| Display name | Human-readable name shown in the OmniFlow UI |
| Description | Short description of what the plugin ingests |
| Author | Your name or organisation |
| Java base package | Root Java package (e.g. `io.github.acme.plugins.myingestor`) |
| Ingestor type key | Used in API paths — `/api/v1/ingest/{type}` |
| Include AI tool? | Scaffold a `PluginTool` that exposes data to OmniFlow AI chat |
| Include webhook action? | Scaffold a `PluginAction` dispatched from OmniFlow scripts |
| Include Next.js UI? | Whether to scaffold a micro frontend |
| OmniFlow plugin-api version | Version of `omniflow-plugin-api` to depend on (default: `0.1`) |
| OmniFlow API base URL | Backend URL for local UI dev (e.g. `http://localhost:8080`) |

## What gets generated

```
<plugin-id>/
├── build.gradle          # Gradle build — Java + optional node-gradle plugin
├── settings.gradle
├── gradlew / gradlew.bat # Wrapper stubs (run `gradle wrapper` for the real ones)
├── src/main/java/…/
│   ├── <Name>Plugin.java          # OmniflowPlugin implementation
│   ├── <Name>Ingestor.java        # PluginIngestor implementation
│   ├── <Name>WebhookAction.java   # Only when "Include webhook action?" = yes
│   └── tools/
│       └── <Name>QueryTool.java   # Only when "Include AI tool?" = yes
├── src/main/resources/
│   └── META-INF/services/…        # ServiceLoader descriptor (auto-generated)
└── ui/                            # Only when "Include Next.js UI?" = yes
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── eslint.config.mjs
    ├── .env.local
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   └── ThemeSync.tsx
    └── lib/
        └── api.ts
```

## Build

### Prerequisites

- **Java 25+** and **Gradle** on your `PATH`
- **Node.js 22+** (only required if you included the UI — node-gradle will download it automatically during `./gradlew jar`)

### Build the JAR

```sh
cd <plugin-id>
gradle wrapper        # generate the real Gradle wrapper (one-time)
./gradlew jar
```

The fat JAR is written to `build/libs/<plugin-id>-1.0.0.jar`. It includes all runtime dependencies and, if you chose to include a UI, the compiled Next.js static export embedded as resources.

To skip the UI build during development:

```sh
./gradlew jar -PskipUi
```

## Upload to OmniFlow

```sh
curl -X POST http://localhost:8080/api/v1/plugins/upload \
  -b "JSESSIONID=<your-session>" \
  -F "file=@build/libs/<plugin-id>-1.0.0.jar"
```

Replace `http://localhost:8080` and the session cookie with your actual backend URL and credentials.

## Develop the UI locally

When you include a Next.js UI you can run it standalone against a live OmniFlow backend — no JAR build required:

```sh
cd <plugin-id>/ui
npm install
npm run dev        # starts on http://localhost:3000
```

The `NEXT_PUBLIC_API_URL` variable in `.env.local` controls which OmniFlow backend the UI talks to.

## AI tools

When you include an AI tool, the scaffolder generates a `PluginTool` implementation that the OmniFlow AI agent can invoke. Tool names are automatically namespaced as `{pluginId}__{name}` to prevent clashes.

After installing the plugin, users can ask the AI agent questions about the ingested data — the agent calls your tool behind the scenes:

```
User:  "Show me the most recent records from my-plugin"
Agent: [calls my-plugin__query-records with limit=5]
```

The generated tool uses `PluginContext.queryRecords()` to fetch data from the host database — no in-memory state required. Customize the `getInputSchema()` and `execute()` methods to add filters, aggregations, or any query logic specific to your data.

See the [deploy-tracker example plugin](https://github.com/ash-thakur-rh/omniflow/tree/main/example-plugins/deploy-tracker) for a full example with multiple AI tools.

## Webhook action

When you include a webhook action, the scaffolder generates a `PluginAction` that posts notifications to a configurable webhook URL. Set the environment variable (e.g. `MY_PLUGIN_WEBHOOK_URL`) to your Slack, Teams, or custom endpoint.

Trigger it from an OmniFlow script:

```
context.dispatch("my-plugin-notify", "Deploy Complete", "v2.3.1 is live", metadata)
```

---

## Contributing to `create-omniflow-plugin`

### Prerequisites

- Node.js 18+
- npm / pnpm

### Install dependencies

```sh
npm install
```

### Build

```sh
npm run build
```

Compiled output lands in `dist/`.

### Watch mode (rebuild on save)

```sh
npm run dev
```

### Test locally

```sh
node dist/index.js
```

Or link it globally so `create-omniflow-plugin` works in any directory:

```sh
npm link
create-omniflow-plugin
```

## Publish to npm

1. Bump the version in `package.json`.
2. Build:
   ```sh
   npm run build
   ```
3. Publish:
   ```sh
   npm publish --access public
   ```

The `files` field in `package.json` ensures only `dist/` is included in the published package.
