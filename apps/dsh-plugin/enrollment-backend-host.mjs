import {applyBootDesktopConfig} from './desktop-enrollment-config.mjs';
export {name, inject, Config} from './standalone-enrollment-host.mjs';

export function apply(ctx, config) {
  applyBootDesktopConfig(ctx, config, {sharedUsb: true});
}
