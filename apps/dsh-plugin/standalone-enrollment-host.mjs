import z from '@deepseek-ai/schemastery';
import {applyBootDesktopConfig} from './desktop-enrollment-config.mjs';

export {name, inject} from './enrollment-host.mjs';
export const Config = z.object({
  enabled: z.boolean().default(false).description('Enable USB enrollment in this Desktop process.'),
  enrollmentDirectory: z.string().default('').description('Existing private enrollment directory.'),
});
export const apply = applyBootDesktopConfig;
