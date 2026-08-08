import { Body, Controller, Delete, Get, Headers, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AlertsService } from "./alerts.service";
import { CreateAlertDto } from "./alerts.dto";

/**
 * Mounted at `market/alerts` so the existing gateway route `/api/v1/market/*`
 * already proxies it (no gateway change). The gateway injects the caller's id as
 * the `x-user-id` header; alerts are scoped to that user.
 */
@ApiTags("alerts")
@Controller("market/alerts")
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  private uid(header?: string): string {
    return header && header.trim() ? header.trim() : "anonymous";
  }

  @Post()
  @ApiOperation({ summary: "Create a price alert" })
  create(@Headers("x-user-id") userId: string, @Body() dto: CreateAlertDto) {
    return this.alerts.create(this.uid(userId), dto);
  }

  @Get()
  @ApiOperation({ summary: "List my price alerts" })
  list(@Headers("x-user-id") userId: string) {
    return this.alerts.list(this.uid(userId));
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a price alert" })
  remove(@Headers("x-user-id") userId: string, @Param("id") id: string) {
    return this.alerts.remove(this.uid(userId), id);
  }

  @Post(":id/reset")
  @ApiOperation({ summary: "Re-arm a triggered alert" })
  reset(@Headers("x-user-id") userId: string, @Param("id") id: string) {
    return this.alerts.reset(this.uid(userId), id);
  }
}
