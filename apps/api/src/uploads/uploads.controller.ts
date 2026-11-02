import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@medshift/shared-types";
import { AuthRequest } from "../auth/auth-request";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CompleteWorkerDocumentUploadDto, SignWorkerDocumentUploadDto } from "./dto/worker-document-upload.dto";
import { UploadsService } from "./uploads.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("uploads/worker-documents")
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("sign")
  @Roles(UserRole.Worker)
  sign(@Req() request: AuthRequest, @Body() dto: SignWorkerDocumentUploadDto) {
    return this.uploadsService.signWorkerDocument(request.user, dto);
  }

  @Post("complete")
  @Roles(UserRole.Worker)
  complete(@Req() request: AuthRequest, @Body() dto: CompleteWorkerDocumentUploadDto) {
    return this.uploadsService.completeWorkerDocument(request.user, dto);
  }

  @Get(":workerId/:documentId/access-url")
  @Roles(UserRole.Worker, UserRole.Admin)
  accessUrl(@Req() request: AuthRequest, @Param("workerId") workerId: string, @Param("documentId") documentId: string) {
    return this.uploadsService.accessWorkerDocument(request.user, workerId, documentId);
  }

  @Get(":documentId/access-url")
  @Roles(UserRole.Worker)
  ownerAccessUrl(@Req() request: AuthRequest, @Param("documentId") documentId: string) {
    return this.uploadsService.accessOwnWorkerDocument(request.user, documentId);
  }
}
