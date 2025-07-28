import {
  Output,
  randomPassword,
  randomSHA512,
  randomString,
  Services,
} from "~templates-utils";
import { Input } from "./meta";

export function generate(input: Input): Output {
  const services: Services = [];
  const secretkey = randomString(32);
  const randomPasswordPostgres = randomPassword();
  const randomPasswordAdmin = randomPassword();
  const randomApiKey = randomSHA512(input.apiString);

  const env = [
    `WAHA_BASE_URL=https://$(PRIMARY_DOMAIN)`,
    `WAHA_API_KEY=sha512:${randomApiKey}`, // WAHA_API_KEY=sha512:62a3ec5ebf520fcaab95d1b208a02093dbf23dd40a13cc4e63e96ddd472a5bd1ad2a3f43e02961848e50ecd6d5cbf6d97a1884122f13e14613b738bdb766a429
    `WAHA_DASHBOARD_ENABLED=True`,
    `WAHA_DASHBOARD_USERNAME=${input.adminUsername}`,
    `WAHA_DASHBOARD_PASSWORD=${randomPasswordAdmin}`,
    `WHATSAPP_SWAGGER_ENABLED=False`,
    `WHATSAPP_SWAGGER_USERNAME=${input.adminUsername}`,
    `WHATSAPP_SWAGGER_PASSWORD=${randomPasswordAdmin}`,
    `WHATSAPP_DEFAULT_ENGINE=${input.engineName}`,
    `WAHA_LOG_FORMAT=JSON`,
    `WAHA_LOG_LEVEL=info`,
    `WAHA_PRINT_QR=False`,
    `WAHA_MEDIA_STORAGE=LOCAL`,
    `WHATSAPP_FILES_LIFETIME=0`,
    `WHATSAPP_FILES_FOLDER=/app/.media`,
    `POSTGRES_DATABASE=$(PROJECT_NAME)`,
    `POSTGRES_HOST=$(PROJECT_NAME)_${input.databaseServiceName}`,
    `POSTGRES_USERNAME=postgres`,
    `POSTGRES_PASSWORD=${randomPasswordPostgres}`,
    `WHATSAPP_SESSIONS_POSTGRESQL_URL=postgres://$(PROJECT_NAME):${randomPasswordPostgres}@$(PROJECT_NAME)_${input.databaseServiceName}:5432/$(PROJECT_NAME)?sslmode=disable`,
    `TZ=${input.timezoneString}`,
    `WHATSAPP_RESTART_ALL_SESSIONS=True`,
  ].join("\n");

  services.push({
    type: "app",
    data: {
      serviceName: input.appServiceName,
      env,
      source: {
        type: "image",
        image: input.appServiceImage,
      },
      domains: [
        {
          host: "$(EASYPANEL_DOMAIN)",
          port: 3000,
        },
      ],
      mounts: [
        {
          type: "volume",
          name: "sessions",
          mountPath: "/app/.sessions",
        },
        {
          type: "volume",
          name: "media",
          mountPath: "/app/.media",
        },
      ],
    },
  });

  services.push({
    type: "postgres",
    data: {
      serviceName: input.databaseServiceName,
      image: "postgres:17",
      password: randomPasswordPostgres,
    },
  });

  return { services };
}
