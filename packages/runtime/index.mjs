export { startOrAttach } from './service.mjs';
export { createHubClient } from './client.mjs';
export { defaultRuntimeDirectory } from './paths.mjs';
export const runtimeCapabilities = Object.freeze({ bleProvisioning: false, lanBinding: false, serviceArbitration: true });
export function requireBleProvisioner() { throw new Error('BLE helper not implemented'); }

export {createNative400NodeControlWindow} from './native400-node-control-window.mjs';
export {prepareNative400NodeControlAccess} from './native400-node-control-channel.mjs';

export {createNative400PetHoldRun} from './native400-pet-hold-run.mjs';
export {createNative400PetHoldHost} from './native400-pet-hold-host.mjs';
export {prepareNative400MediaTransfer, prepareNative400AuthenticatedMediaTransfer} from './native400-tcp-media.mjs';
export {createNative400UsbPairing} from './native400-usb-pairing.mjs';
export {createNative400PersistentUsbPairing} from './native400-pbp1-binding.mjs';
export {openNative400Pbp1Serial} from './native400-pbp1-serial.mjs';
export {createNative400LanMaintenance} from './native400-pma1-lan.mjs';
