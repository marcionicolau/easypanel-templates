import {
  Output,
  randomPassword,
  randomString,
  Services,
} from "~templates-utils";
import { Input } from "./meta";

export function generate(input: Input): Output {
  const services: Services = [];
  const secretkey = randomString(32);
  const randomPasswordPostgres = randomPassword();
  const randomRabbitmqPassword = randomPassword();
  const randomR2RDashboardPassword = randomPassword();

  const hatchet_env = [
    `HATCHET_CLIENT_GRPC_MAX_RECV_MESSAGE_LENGTH=134217728`,
    `HATCHET_CLIENT_GRPC_MAX_SEND_MESSAGE_LENGTH=134217728`,
    `DATABASE_POSTGRES_PORT=5432`,
    `DATABASE_POSTGRES_HOST=hatchet-postgres`,
    `DATABASE_POSTGRES_USERNAME=hatchet_user`,
    `DATABASE_POSTGRES_PASSWORD=${randomPasswordPostgres}`,
    `HATCHET_DATABASE_POSTGRES_DB_NAME=hatchet`,
    `POSTGRES_DB=hatchet`,
    `POSTGRES_USER=hatchet_user`,
    `POSTGRES_PASSWORD=${randomPasswordPostgres}`,
    `SERVER_TASKQUEUE_RABBITMQ_URL=amqp://user:password@hatchet-rabbitmq:5672/`,
    `SERVER_AUTH_COOKIE_DOMAIN=http://host.docker.internal:7274`,
    `SERVER_URL=http://host.docker.internal:7274`,
    `SERVER_AUTH_COOKIE_INSECURE=t`,
    `SERVER_GRPC_BIND_ADDRESS=0.0.0.0`,
    `SERVER_GRPC_INSECURE=t`,
    `SERVER_GRPC_BROADCAST_ADDRESS=hatchet-engine:7077`,
    `SERVER_GRPC_MAX_MSG_SIZE=134217728`,
    `SERVER_GRPC_PORT="7077"`,
  ].join("\n");

  const r2r_env_full = [
    `# R2R`,
    `R2R_PORT=7272`,
    `R2R_HOST=0.0.0.0`,
    `R2R_LOG_LEVEL=INFO`,
    `R2R_CONFIG_NAME=`,
    `R2R_CONFIG_PATH=/app/user_configs/my_config.toml`,
    `R2R_PROJECT_NAME=r2r_default`,
    `R2R_SECRET_KEY=`,
    `R2R_USER_TOOLS_PATH=`,
    `R2R_LOG_FORMAT=`,
    `# Postgres Configuration`,
    `R2R_POSTGRES_USER=postgres`,
    `R2R_POSTGRES_PASSWORD=${randomPasswordPostgres}`,
    `R2R_POSTGRES_HOST=postgres`,
    `R2R_POSTGRES_PORT=5432`,
    `R2R_POSTGRES_DBNAME=postgres`,
    `R2R_POSTGRES_MAX_CONNECTIONS=1024`,
    `R2R_POSTGRES_STATEMENT_CACHE_SIZE=100`,
    `# Hatchet`,
    `HATCHET_CLIENT_TLS_STRATEGY=none`,
    `# Unstructured`,
    `UNSTRUCTURED_API_KEY=`,
    `UNSTRUCTURED_API_URL=https://api.unstructured.io/general/v0/general`,
    `UNSTRUCTURED_SERVICE_URL=http://unstructured:7275`,
    `UNSTRUCTURED_NUM_WORKERS=10`,
    `# Graphologic`,
    `CLUSTERING_SERVICE_URL=http://graph_clustering:7276`,
  ].join("\n");

  const env = [hatchet_env, r2r_env_full].join("\n");

  services.push({
    type: "postgres",
    data: {
      serviceName: "postgres",
      password: randomPasswordPostgres,
    },
  });

  services.push({
    type: "postgres",
    data: {
      serviceName: "hatchet-postgres",
      password: randomPasswordPostgres,
    },
  });

  services.push({
    type: "app",
    data: {
      serviceName: "hatchet-rabbitmq",
      source: {
        type: "image",
        image: input.hatchetRabbitmqImage,
      },
      env: [
        `RABBITMQ_DEFAULT_VHOST=/`,
        `RABBITMQ_DEFAULT_USER=user`,
        `RABBITMQ_DEFAULT_PASS=${randomRabbitmqPassword}`,
      ].join("\n"),
      domains: [
        {
          host: "$(EASYPANEL_DOMAIN)",
          port: 5672,
        },
      ],
      mounts: [
        {
          type: "volume",
          name: "rabbitmq_data",
          mountPath: "/var/lib/rabbitmq",
        },
      ],
    },
  });

  services.push({
    type: "app",
    data: {
      serviceName: "hatchet-create-db",
      env: hatchet_env,
      source: {
        type: "image",
        image: "postgres:17",
      },
      mounts: [
        {
          type: "file",
          content: [
            "#!/bin/bash",
            "",
            "set -e",
            "echo 'Waiting for PostgreSQL to be ready...'",
            "while ! pg_isready -h hatchet-postgres -p 5432 -U ${HATCHET_POSTGRES_USER:-hatchet_user}; do",
            "  sleep 1",
            "done",
            "",
            "echo 'PostgreSQL is ready, checking if database exists...'",
            "if ! PGPASSWORD=${HATCHET_POSTGRES_PASSWORD:-hatchet_password} psql -h hatchet-postgres -p 5432 -U ${HATCHET_POSTGRES_USER:-hatchet_user} -lqt | grep -qw ${HATCHET_POSTGRES_DBNAME:-hatchet}; then",
            "echo 'Database does not exist, creating it...'",
            "PGPASSWORD=${HATCHET_POSTGRES_PASSWORD:-hatchet_password} createdb -h hatchet-postgres -p 5432 -U ${HATCHET_POSTGRES_USER:-hatchet_user} -w ${HATCHET_POSTGRES_DBNAME:-hatchet}",
            "fi",
            "",
            "else",
            "echo 'Database already exists, skipping creation.'",
            "fi",
            "",
          ].join("\n"),
          mountPath: "/scripts/create-hatchet-db.sh",
        },
      ],
    },
  });

  services.push({
    type: "app",
    data: {
      serviceName: "hatchet-migration",
      env: hatchet_env,
      source: {
        type: "image",
        image: input.hatchetMigrationImage,
      },
    },
  });

  services.push({
    type: "app",
    data: {
      serviceName: "hatchet-setup-config",
      env: hatchet_env,
      source: {
        type: "image",
        image: input.hatchetSetupConfigImage,
      },
      mounts: [
        {
          type: "volume",
          name: "hatchet_certs",
          mountPath: "/hatchet/certs",
        },
        {
          type: "volume",
          name: "hatchet_config",
          mountPath: "/hatchet/config",
        },
      ],
    },
  });

  services.push({
    type: "app",
    data: {
      serviceName: "hatchet-engine",
      env: hatchet_env,
      source: {
        type: "image",
        image: input.hatchetEngineImage,
      },
      domains: [
        {
          host: "$(EASYPANEL_DOMAIN)",
          port: 7077,
        },
      ],
      mounts: [
        {
          type: "volume",
          name: "hatchet_certs",
          mountPath: "/hatchet/certs",
        },
        {
          type: "volume",
          name: "hatchet_config",
          mountPath: "/hatchet/config",
        },
      ],
    },
  });

  services.push({
    type: "app",
    data: {
      serviceName: "hatchet-dashboard",
      env: hatchet_env,
      source: {
        type: "image",
        image: input.hatchetDashboardImage,
      },
      domains: [
        {
          host: "$(EASYPANEL_DOMAIN)",
          port: 80,
        },
      ],
      ports: [
        {
          published: 80,
          target: 7274,
          protocol: "tcp",
        },
      ],
      mounts: [
        {
          type: "volume",
          name: "hatchet_certs",
          mountPath: "/hatchet/certs",
        },
        {
          type: "volume",
          name: "hatchet_config",
          mountPath: "/hatchet/config",
        },
      ],
    },
  });

  services.push({
    type: "app",
    data: {
      serviceName: "setup-token",
      source: {
        type: "image",
        image: input.hatchetSetupTokenImage,
      },
      // command: ["sh /scripts/setup-token.sh"],
      mounts: [
        {
          type: "volume",
          name: "hatchet_certs",
          mountPath: "/hatchet/certs",
        },
        {
          type: "volume",
          name: "hatchet_config",
          mountPath: "/hatchet/config",
        },
        {
          type: "volume",
          name: "hatchet_api_key",
          mountPath: "/hatchet_api_key",
        },
        {
          type: "file",
          content: [
            "#!/bin/bash",
            "",
            "set -e",
            "echo 'Starting token creation process...'",
            "",
            "# Attempt to create token and capture both stdout and stderr",
            "TOKEN_OUTPUT=$(/hatchet/hatchet-admin token create --config /hatchet/config --tenant-id 707d0855-80ab-4e1f-a156-f1c4546cbf52 2>&1)",
            "",
            "# Extract the token (assuming it's the only part that looks like a JWT)",
            "TOKEN=$(echo \"$TOKEN_OUTPUT\" | grep -Eo 'eyJ[A-Za-z0-9_-]*.eyJ[A-Za-z0-9_-]*.[A-Za-z0-9_-]*')",
            "",
            'if [ -z "$TOKEN" ]; then',
            "echo 'Error: Failed to extract token. Full command output:' >&2",
            'echo "$TOKEN_OUTPUT" >&2',
            "exit 1",
            "fi",
            "",
            'echo "$TOKEN" > /tmp/hatchet_api_key',
            "echo 'Token created and saved to /tmp/hatchet_api_key'",
            "",
            "# Copy token to final destination",
            'echo -n "$TOKEN" > /hatchet_api_key/api_key.txt',
            "echo 'Token copied to /hatchet_api_key/api_key.txt'",
            "",
            "# Verify token was copied correctly",
            'if [ "$(cat /tmp/hatchet_api_key)" != "$(cat /hatchet_api_key/api_key.txt)" ]; then',
            "echo 'Error: Token copy failed, files do not match' >&2",
            "echo 'Content of /tmp/hatchet_api_key:'",
            "cat /tmp/hatchet_api_key",
            "echo 'Content of /hatchet_api_key/api_key.txt:'",
            "cat /hatchet_api_key/api_key.txt",
            "exit 1",
            "fi",
            "",
            "echo 'Hatchet API key has been saved successfully'",
            "echo 'Token length:' ${#TOKEN}",
            "echo 'Token (first 20 chars):' ${TOKEN:0:20}",
            "echo 'Token structure:' $(echo $TOKEN | awk -F. '{print NF-1}') 'parts'",
            "",
            "# Check each part of the token",
            "for i in 1 2 3; do",
            "PART=$(echo $TOKEN | cut -d. -f$i)",
            "echo 'Part' $i 'length:' ${#PART}",
            "echo 'Part' $i 'base64 check:' $(echo $PART | base64 -d >/dev/null 2>&1 && echo 'Valid' || echo 'Invalid')",
            "done",
            "",
            "# Final validation attempt",
            "if ! echo $TOKEN | awk -F. '{print $2}' | base64 -d 2>/dev/null | jq . >/dev/null 2>&1; then",
            "echo 'Warning: Token payload is not valid JSON when base64 decoded' >&2",
            "else",
            "echo 'Token payload appears to be valid JSON'",
            "fi",
            "",
          ].join("\n"),
          mountPath: "/scripts/setup-token.sh",
        },
      ],
    },
  });

  services.push({
    type: "app",
    data: {
      serviceName: "unstructured",
      source: {
        type: "image",
        image: input.unstructuredImage,
      },
    },
  });

  services.push({
    type: "app",
    data: {
      serviceName: "graph_clustering",
      source: {
        type: "image",
        image: input.graphClusteringImage,
      },
      domains: [
        {
          host: "$(EASYPANEL_DOMAIN)",
          port: 7276,
        },
      ],
    },
  });

  services.push({
    type: "app",
    data: {
      serviceName: input.appServiceName,
      env: r2r_env_full,
      source: {
        type: "image",
        image: input.r2rImage,
      },
      // command: "sh /scripts/start-r2r.sh",
      domains: [
        {
          host: "$(EASYPANEL_DOMAIN)",
          port: 7272,
        },
      ],
      mounts: [
        {
          type: "volume",
          name: "hatchet_api_key",
          mountPath: "/hatchet_api_key",
        },
        {
          type: "file",
          content: [
            "#!/bin/bash",
            "",
            "# Check if HATCHET_CLIENT_TOKEN is set, if not read it from the API key file",
            'if [ -z "${HATCHET_CLIENT_TOKEN}" ]; then',
            "  export HATCHET_CLIENT_TOKEN=$(cat /hatchet_api_key/api_key.txt)",
            "fi",
            "",
            "# Start the application",
            "exec uvicorn core.main.app_entry:app --host ${R2R_HOST} --port ${R2R_PORT}",
          ].join("\n"),
          mountPath: "/app/user_configs/",
        },
        {
          type: "file",
          content: [
            "[app]",
            "# LLM used for internal operations, like deriving conversation names",
            "fast_llm = 'ollama/llama3.1'",
            "# LLM used for user-facing output, like RAG replies",
            "quality_llm = 'ollama/llama3.1'",
            "",
            "# LLM used for ingesting visual inputs",
            "vlm = 'ollama/llama3.1'",
            "# LLM used for transcription",
            "audio_lm = 'ollama/llama3.1'",
            "",
            "# Reasoning model, used for `research` agent",
            "reasoning_llm = 'ollama/llama3.1'",
            "# Planning model, used for `research` agent",
            "planning_llm = 'ollama/llama3.1'",
            "",
            "[embedding]",
            "provider = 'ollama'",
            "base_model = 'mxbai-embed-large'",
            "base_dimension = 1_024",
            "batch_size = 128",
            "concurrent_request_limit = 2",
            "",
            "[completion_embedding]",
            "provider = 'ollama'",
            "base_model = 'mxbai-embed-large'",
            "base_dimension = 1_024",
            "batch_size = 128",
            "concurrent_request_limit = 2",
            "",
            "[agent]",
            "tools = ['search_file_knowledge']",
            "",
            "[completion]",
            "provider = 'litellm'",
            "concurrent_request_limit = 1",
            "",
            "[completion.generation_config]",
            "temperature = 0.1",
            "top_p = 1",
            "max_tokens_to_sample = 1_024",
            "stream = false",
            "api_base = 'http://host.docker.internal:11434'",
            "",
            "[ingestion]",
            "provider = 'unstructured_local'",
            "strategy = 'auto'",
            "chunking_strategy = 'by_title'",
            "new_after_n_chars = 512",
            "max_characters = 1_024",
            "combine_under_n_chars = 128",
            "overlap = 20",
            "chunks_for_document_summary = 16",
            "document_summary_model = 'ollama/llama3.1'",
            "automatic_extraction = false",
            "",
            "[orchestration]",
            "provider = 'hatchet'",
            "",
          ].join("\n"),
          mountPath: "/app/user_configs/my_config.toml",
        },
      ],
    },
  });

  services.push({
    type: "app",
    data: {
      serviceName: `${input.appServiceName}-dashboard`,
      env: [
        `NEXT_PUBLIC_R2R_DEPLOYMENT_URL=https://$(PRIMARY_DOMAIN):7272`,
        `NEXT_PUBLIC_HATCHET_DASHBOARD_URL=https://$(PRIMARY_DOMAIN):7274`,
        `NEXT_PUBLIC_R2R_DEFAULT_EMAIL=${input.r2rDashboardEmail}`,
        `NEXT_PUBLIC_R2R_DEFAULT_PASSWORD=${randomR2RDashboardPassword}`,
      ].join("\n"),
      source: {
        type: "image",
        image: input.r2rDashboardImage,
      },
      domains: [
        {
          host: "$(EASYPANEL_DOMAIN)",
          port: 3000,
        },
      ],
      ports: [
        {
          published: 7273,
          target: 3000,
          protocol: "tcp",
        },
      ],
    },
  });

  return { services };
}
