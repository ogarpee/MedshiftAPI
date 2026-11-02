import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";

@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  async check() {
    if (this.connection.readyState !== 1 || !this.connection.db) throw new ServiceUnavailableException("Database is unavailable");
    await this.connection.db.admin().ping();
    return {
      status: "ok",
      service: "medshift-api",
      database: "connected",
      timestamp: new Date().toISOString()
    };
  }
}
