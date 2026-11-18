import z from '@deepseek-ai/schemastery';
import {applyVp8BootDesktopConfig} from './vp8-boot-desktop-config.mjs';

export {name, inject} from './host-vp8-boot-rc3.mjs';
export const Config = z.object({
  enabled: z.boolean().default(false).description('Enable USB enrollment in this Desktop process.'),
  enrollmentDirectory: z.string().default('').description('Existing private enrollment directory.'),
});
export const apply = applyVp8BootDesktopConfig;
