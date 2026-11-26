import z from '@deepseek-ai/schemastery';
import {dirname, isAbsolute} from 'node:path';
import {Config as desktopConfig} from './connection-host.mjs';
import {apply as applyDesktop} from './legacy-desktop-host.mjs';
import {applyBootDesktopConfig} from './desktop-enrollment-config.mjs';
import {createDesktopDeviceLan} from '../../packages/runtime/desktop-device-lan.mjs';
import {openCodexHookTaskSource} from '../../packages/runtime/codex-hook-source.mjs';
import {openCodexTaskSource, openDshTaskAggregate, openDshTaskSource, openPetTaskSource} from '../../packages/runtime/local-task-sources.mjs';
import {openTaskSelection} from '../../packages/runtime/task-source-selection.mjs';
import {isPetSessionId} from '../../packages/source-pet/session-state.mjs';
import {registerTaskSourceRoutes} from './task-source-routes.mjs';

export {name, inject} from './connection-host.mjs';

export const Config = z.object({...desktopConfig.dict,
  unifiedDeviceStatus: z.boolean().default(false).description('Use unified status on a prepared device.'),
  deviceStatusPush: z.boolean().default(false).description('Subscribe to device status.'),
  deviceLan: z.object({
    enabled: z.boolean().default(false).description('Start LAN status and control for an existing enrollment.'),
    address: z.string().default('').description('Private IPv4 on the device LAN.'),
    port: z.string().default('').description('TCP port assigned to this Hub.'),
    discoveryInterface: z.string().default('').description('Optional macOS interface for local service discovery.'),
  }).default({}),
  taskMotion: z.object({
    enabled: z.boolean().default(false).description('Enable task-source settings.'),
    source: z.string().default('').description('Explicit loopback pet state source base URL.'),
    sessionId: z.string().default('').description('Single DSH session allowed to drive animation.'),
    codexSocket: z.string().default('').description('Explicit local Codex App Server Unix socket.'),
    codexHookSocket: z.string().default('').description('Private Unix socket for the Codex App project hook candidate. Exclusive with codexSocket.'),
  }).default({}),
  deviceEnrollment: z.object({
    enabled: z.boolean().default(false).description('Enable USB device enrollment in this Desktop instance.'),
    enrollmentDirectory: z.string().default('').description('Existing private device enrollment directory.'),
  }).default({}),
});

export function apply(ctx, {deviceEnrollment, unifiedDeviceStatus, deviceStatusPush, deviceLan, taskMotion, ...config} = {}, options) {
  const statusPush = Boolean(unifiedDeviceStatus && deviceStatusPush && deviceEnrollment?.enabled);
  const lan = deviceLan?.enabled && statusPush && config.desktopDeviceQuery &&
    config.managedDesktopDevice && config.desktopDeviceNoCode && !config.deviceUpdateOrigin && !options?.connectTelemetry ?
    createDesktopDeviceLan({address: deviceLan.address, port: Number(deviceLan.port), discoveryInterface: deviceLan.discoveryInterface}) : null;
  applyBootDesktopConfig(ctx, deviceEnrollment, {sharedUsb: true, statusV2: unifiedDeviceStatus, connectLan: lan?.connectEnrollment,
    lanDiscovery: Boolean(lan && deviceLan.discoveryInterface)});
  const applied = applyDesktop(ctx, config, {...options, statusV2: unifiedDeviceStatus, statusPush,
    connectTelemetry: lan?.connectTelemetry ?? options?.connectTelemetry});
  if (taskMotion?.enabled && config.managedDesktopDevice && config.desktopDeviceNoCode && config.desktopDeviceQuery &&
      !config.deviceUpdateOrigin && process.platform === 'darwin' && process.versions.electron &&
      ctx.get('profileContext')?.name === 'desktop') ctx.effect(() => {
    const {source, sessionId, codexSocket, codexHookSocket} = taskMotion;
    function dshRead(method, request, signal) {
      const controller = ctx.get('sessionController', false);
      if (typeof controller?.[method] !== 'function') throw Error('dsh_task_state_unavailable');
      return controller[method](request, signal);
    }
    const readState = (request, signal) => dshRead('state', request, signal);
    const readEvents = (request, signal) => dshRead('events', request, signal);
    const readers = {dsh: id => openDshTaskSource(id, readState, readEvents)};
    const aggregateReaders = {};
    if (typeof ctx.get('sessionController', false)?.list === 'function') {
      aggregateReaders.dsh = id => openDshTaskAggregate(id, (request, signal) => dshRead('list', request, signal), readState, readEvents);
    }
    if (!codexHookSocket && isAbsolute(codexSocket ?? '')) readers.codex = id => openCodexTaskSource(id, {socket: codexSocket});
    if (!codexSocket && isAbsolute(codexHookSocket ?? '')) {
      readers.codex = id => openCodexHookTaskSource(id, codexHookSocket);
      aggregateReaders.codex = id => openCodexHookTaskSource(id, codexHookSocket, {all: true});
    }
    if (source) readers.pet = () => openPetTaskSource(source);
    const defaults = source && isPetSessionId(sessionId) ? {source: 'pet', sessionId} : {source: 'off', sessionId: ''};
    try {
      const owner = openTaskSelection({directory: dirname(config.runtimeDirectory), defaults, readers, aggregateReaders, lan});
      return registerTaskSourceRoutes(ctx, owner);
    } catch { console.error('[dsh-pet-hub] Task sources unavailable.'); }
  }, 'pet-hub: task-source settings');
  return applied;
}
