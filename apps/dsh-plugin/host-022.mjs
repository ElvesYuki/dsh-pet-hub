import z from '@deepseek-ai/schemastery';
import {defaultRuntimeDirectory} from '../../packages/runtime/paths.mjs';
import {apply as applyRoutes} from './index.mjs';
import {mountDesktopQueryService} from './desktop-query-service.mjs';
export {name} from './index.mjs';
export const inject = ['webServer', 'connection'];
export const Config=z.object({runtimeDirectory:z.string().default(defaultRuntimeDirectory()).description('Private shared Hub runtime directory.'),
  vp8DesktopQuery:z.boolean().default(false).description('Enable read-only VP8 query through the trusted Desktop connection.'),
  vp8DesktopManaged:z.boolean().default(false).description('Start a read-only Hub within the macOS Desktop plugin lifecycle.'),
  vp8DesktopNoCode:z.boolean().default(false).description('Authorize status and queries in the managed Desktop session.'),
  vp8UpdateOrigin:z.string().default('').description('Explicit loopback origin for VP8 action updates. Empty disables the controls.')});

export function apply(ctx, config = {}) {
  if (config.vp8DesktopNoCode && !config.vp8DesktopManaged) throw new Error('managed_desktop_only');
  if (config.vp8DesktopManaged) {
    if (!config.vp8DesktopQuery || config.vp8UpdateOrigin || process.platform !== 'darwin' ||
        !process.versions.electron || ctx.get('profileContext')?.name !== 'desktop') throw new Error('managed_desktop_only');
  }
  const access = config.vp8DesktopManaged ? mountDesktopQueryService(ctx, config.runtimeDirectory) : undefined;
  applyRoutes(ctx, config, {managedVp8: config.vp8DesktopNoCode ? access : undefined});
}
