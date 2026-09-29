import type { Role } from "@wyd/shared";
export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  team: string;
  homestayId: number | null;
}
declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}
