import { Output, Services } from "~templates-utils";
import { Input } from "./meta";

export function generate(input: Input): Output {
  const services: Services = [];

  services.push({
    type: "compose",
    data: {
      serviceName: input.serviceName,
      source: {
        type: "git",
        repo: "https://github.com/easypanel-io/compose.git",
        ref: "21-05-2025",
        rootPath: "/plane/code",
        composeFile: "docker-compose.yml",
      },
      domains: [
        {
          host: "$(EASYPANEL_DOMAIN)",
          port: 80,
          service: "proxy",
        },
      ],
    },
  });

  return { services };
}
