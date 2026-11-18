import {applyVp8BootDesktopConfig} from './vp8-boot-desktop-config.mjs';
export {name, inject, Config} from './host-vp8-boot-config-rc3.mjs';

export function apply(ctx, config) {
  applyVp8BootDesktopConfig(ctx, config, {sharedUsb: true});
}
