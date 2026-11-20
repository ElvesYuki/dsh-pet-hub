import z from '@deepseek-ai/schemastery';
import {defaultRuntimeDirectory} from '../../packages/runtime/paths.mjs';
import {apply as applyRoutes} from './index.mjs';
import {mountDesktopQueryService} from './desktop-query-service.mjs';
export {name} from './index.mjs';
export const inject = ['webServer', 'connection'];
export const Config=z.object({runtimeDirectory:z.string().default(defaultRuntimeDirectory()).description('Private shared Hub runtime directory.'),
  desktopDeviceQuery:z.boolean().default(false).description('Enable read-only device query through the trusted Desktop connection.'),
  managedDesktopDevice:z.boolean().default(false).description('Start a read-only Hub within the macOS Desktop plugin lifecycle.'),
  desktopDeviceNoCode:z.boolean().default(false).description('Authorize status and queries in the managed Desktop session.'),
  deviceUpdateOrigin:z.string().default('').description('Explicit loopback origin for device updates. Empty disables the controls.')});

export function apply(ctx, config = {}) {
  if (config.desktopDeviceNoCode && !config.managedDesktopDevice) throw new Error('managed_desktop_only');
  if (config.managedDesktopDevice) {
    if (!config.desktopDeviceQuery || config.deviceUpdateOrigin || process.platform !== 'darwin' ||
        !process.versions.electron || ctx.get('profileContext')?.name !== 'desktop') throw new Error('managed_desktop_only');
  }
  const access = config.managedDesktopDevice ? mountDesktopQueryService(ctx, config.runtimeDirectory) : undefined;
  applyRoutes(ctx, config, {managedDeviceUpdate: config.desktopDeviceNoCode ? access : undefined});
}
