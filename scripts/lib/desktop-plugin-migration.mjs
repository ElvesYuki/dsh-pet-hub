import {isAbsolute, normalize} from 'node:path';
import {keys, requireThat as need} from '../../packages/core/protocol.mjs';

const main = 'dsh-pet-hub', registration = 'dsh-pet-hub-boot-review';

/** Plan the observed two-bundle desktop layout on parsed data. The caller owns disk I/O and rollback. */
export function planDesktopPluginMigration({bundles, patches}) {
  const valid = 'device_single_migration_layout';
  need(Array.isArray(bundles) && new Set(bundles).size === bundles.length &&
    bundles.every(id => typeof id === 'string') && bundles.includes(main) && bundles.includes(registration), valid);
  need(Array.isArray(patches), valid);
  const primary = patches.filter(patch => patch?.id === main), legacy = patches.filter(patch => patch?.id === registration);
  need(primary.length === 1 && legacy.length === 1, valid);
  const [hub] = primary, [boot] = legacy;
  keys(boot, ['id', 'config']);
  keys(boot.config, ['enabled', 'enrollmentDirectory']);
  const {enabled = false, enrollmentDirectory = ''} = boot.config;
  need(typeof enabled === 'boolean' && typeof enrollmentDirectory === 'string' && !enrollmentDirectory.includes('\0') &&
    (enrollmentDirectory === '' ? !enabled : isAbsolute(enrollmentDirectory) && normalize(enrollmentDirectory) === enrollmentDirectory), valid);
  need(hub.config && typeof hub.config === 'object' && !Array.isArray(hub.config) && !Object.hasOwn(hub.config, 'deviceEnrollment'), valid);
  return {bundles: bundles.filter(id => id !== registration), patches: patches.filter(patch => patch !== boot).map(patch =>
    patch === hub ? {...hub, config: {...hub.config, deviceEnrollment: {enabled, enrollmentDirectory}}} : patch)};
}
