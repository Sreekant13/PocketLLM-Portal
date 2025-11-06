import { FastifyInstance } from "fastify";
import { snapshot, reset } from "../services/metrics";

export default async function (f: FastifyInstance) {
  f.get("/api/v1/admin/health", () => ({ status: "ok", time: Date.now() }));
  f.get("/api/v1/admin/metrics", () => snapshot());
  f.post("/api/v1/admin/metrics/reset", () => (reset(), { ok: true }));
}
