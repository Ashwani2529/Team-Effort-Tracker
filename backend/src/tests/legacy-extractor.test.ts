import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXPECTED_LEGACY, extractLegacyStarter, legacyCounts } from '../services/legacy-extractor.js';
describe('legacy extraction', () => {
  it('extracts the complete source with acceptance-gate counts', async () => {
    const { starter, checksum } = await extractLegacyStarter(resolve(process.cwd(), '../portfolio-delivery-hub-COMPLETE.html'));
    expect(starter.id).toBe('sbm-delivery-board-2026-11-21'); expect(legacyCounts(starter)).toEqual(EXPECTED_LEGACY); expect(checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});
