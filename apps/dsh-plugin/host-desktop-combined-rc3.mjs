import {apply as applyOriginal} from './host-022.mjs';
import {apply as applyRoutes} from './index.mjs';
import {mountDesktopQueryService} from './desktop-query-service.mjs';
export {name, inject, Config} from './host-022.mjs';

export function apply(ctx, config = {}) {
  if (!config.vp8DesktopNoCode || !config.vp8DesktopManaged || !config.vp8DesktopQuery || config.vp8UpdateOrigin ||
      process.platform !== 'darwin' || !process.versions.electron || ctx.get('profileContext')?.name !== 'desktop') {
    return applyOriginal(ctx, config);
  }
  const managedVp8 = mountDesktopQueryService(ctx, config.runtimeDirectory, {sharedUsb: true});
  return applyRoutes(ctx, config, {managedVp8, desktopBattery: true});
}
