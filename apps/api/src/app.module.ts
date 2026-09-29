import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./auth/auth.guard.js";
import { AuthController } from "./auth/auth.controller.js";
import { UsersController } from "./auth/users.controller.js";
import { UsersCache } from "./auth/users.cache.js";
import { TablesController } from "./tables/tables.controller.js";
import { PublicController } from "./tables/public.controller.js";
import { TablesService } from "./tables/tables.service.js";
import { VisitorsController } from "./visitors/visitors.controller.js";
import { EventsController } from "./events/events.controller.js";
import { EventsService } from "./events/events.service.js";
import { UploadsController } from "./uploads/uploads.controller.js";
import { WydController } from "./wyd/wyd.controller.js";
import { WydService } from "./wyd/wyd.service.js";

@Module({
  controllers: [
    AuthController,
    UsersController,
    TablesController,
    PublicController,
    VisitorsController,
    EventsController,
    UploadsController,
    WydController,
  ],
  providers: [UsersCache, TablesService, EventsService, WydService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
