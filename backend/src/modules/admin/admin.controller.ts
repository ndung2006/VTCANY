import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePerms } from '../auth/permissions.decorator';
import { AuditService } from '../audit/audit.service';
import { END_USERS } from '../auth/users.store';
import { CategoryService, CreateCategoryDto } from './category.service';

class CategoryDto implements CreateCategoryDto {
  @IsString() name!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isVisible?: boolean;
  @IsOptional() @IsArray() platforms?: string[];
  @IsOptional() @IsArray() appliesTo?: string[];
}

@UseGuards(PermissionsGuard)
@Controller('admin')
export class AdminController {
  constructor(private categories: CategoryService, private audit: AuditService) {}

  private actor(req: any) {
    return { actor: req.user?.username || 'unknown', role: req.user?.role };
  }

  private bad(e: any) {
    const msg = e?.message || 'bad request';
    const code = msg === 'not found' ? 'not_found' : 'bad_request';
    const status = msg === 'not found' ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
    throw new HttpException({ error: { code, message: msg } }, status);
  }

  // ---- Danh mục ----
  @RequirePerms('category:read')
  @Get('categories')
  listCategories() {
    return { data: this.categories.list() };
  }

  @RequirePerms('category:create')
  @Post('categories')
  createCategory(@Body() dto: CategoryDto, @Req() req: any) {
    try {
      const c = this.categories.create(dto);
      this.audit.record({ at: Date.now(), ...this.actor(req), action: 'category.create', resource: c.id });
      return c;
    } catch (e) {
      this.bad(e);
    }
  }

  @RequirePerms('category:update')
  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: CategoryDto, @Req() req: any) {
    try {
      const c = this.categories.update(id, dto);
      this.audit.record({ at: Date.now(), ...this.actor(req), action: 'category.update', resource: id });
      return c;
    } catch (e) {
      this.bad(e);
    }
  }

  @RequirePerms('category:delete')
  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string, @Req() req: any) {
    try {
      const r = this.categories.remove(id);
      this.audit.record({ at: Date.now(), ...this.actor(req), action: 'category.delete', resource: id });
      return r;
    } catch (e) {
      this.bad(e);
    }
  }

  // ---- Người dùng (đọc) ----
  @RequirePerms('user:read')
  @Get('users')
  listUsers() {
    return {
      data: END_USERS.map((u: any) => ({
        id: u.id,
        email: u.email,
        phone: u.phone ?? null,
        avatar: u.avatar ?? null,
        provider: u.provider ?? null,
        status: u.status ?? 'active',
        createdAt: u.createdAt ?? null,
      })),
    };
  }
}
