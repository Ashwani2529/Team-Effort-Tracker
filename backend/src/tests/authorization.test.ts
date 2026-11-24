import { describe, expect, it } from 'vitest';
import { can } from '@effort-tracker/shared';
describe('authorization matrix', () => {
  it('allows team members to edit general project work', () => expect(can('team', 'edit')).toBe(true));
  it('keeps premium tabs and exports admin-only', () => { expect(can('admin', 'export')).toBe(true); expect(can('team', 'export')).toBe(false); expect(can('team', 'reports')).toBe(false); });
  it('keeps destructive and project-management actions admin-only', () => { expect(can('admin', 'delete')).toBe(true); expect(can('team', 'manageProject')).toBe(false); });
});
