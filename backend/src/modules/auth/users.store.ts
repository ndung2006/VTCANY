import * as bcrypt from 'bcryptjs';

export type Role = 'admin' | 'editor';

export interface CmsUser {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
}

// Seed 2 tai khoan van hanh CMS. Postgres thay store nay, giu nguyen shape.
export const USERS: CmsUser[] = [
  { id: 'u-admin-1', username: 'admin', passwordHash: bcrypt.hashSync('admin123', 10), role: 'admin' },
  { id: 'u-editor-1', username: 'editor', passwordHash: bcrypt.hashSync('editor123', 10), role: 'editor' },
];

const ROLE_PERMS: Record<Role, string[]> = {
  admin: ['*'],
  editor: ['video:read', 'video:create', 'video:submit', 'epg:read', 'epg:write'],
};

export function hasPermission(role: Role, perm: string): boolean {
  const perms = ROLE_PERMS[role] || [];
  return perms.includes('*') || perms.includes(perm);
}
