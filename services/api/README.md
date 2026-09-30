# services/api — Core API (NestJS)

Implementation hiện tại nằm ở `../../backend/` (NestJS 10 + JWT + in-memory store ở Phase 1).

Bước 1/8 chỉ yêu cầu skeleton + migration. Migration chuẩn ở:
- `prisma/migrations/0001_step1_init.sql` (bản copy)
- `../../backend/prisma/migrations/0001_step1_init.sql` (bản chính)

Bước 2 sẽ xây dựng tiếp: `GET /api/v1/layout/home`, `POST /auth/oauth/:provider`,
`POST /auth/admin/login`, `GET /auth/me` + seed trang chủ.
