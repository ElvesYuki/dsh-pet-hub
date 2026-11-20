import {apply as applyOriginal} from './connection-host.mjs';
import {apply as applyRoutes} from './index.mjs';
import {mountDesktopQueryService} from './desktop-query-service.mjs';
export {name, inject, Config} from './connection-host.mjs';

export function apply(ctx, config = {}, {connectTelemetry, statusV2, statusPush} = {}) {
  if (!config.desktopDeviceNoCode || !config.managedDesktopDevice || !config.desktopDeviceQuery || config.deviceUpdateOrigin ||
      process.platform !== 'darwin' || !process.versions.electron || ctx.get('profileContext')?.name !== 'desktop') {
    return applyOriginal(ctx, config);
  }
  const managedDeviceUpdate = mountDesktopQueryService(ctx, config.runtimeDirectory, {sharedUsb: true, connectTelemetry, statusV2, statusPush});
  return applyRoutes(ctx, config, {managedDeviceUpdate, desktopBattery: true});
}
