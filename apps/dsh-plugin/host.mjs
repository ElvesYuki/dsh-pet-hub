import z from '@deepseek-ai/schemastery';
import { defaultRuntimeDirectory } from '../../packages/runtime/paths.mjs';
export { name, inject, apply } from './index.mjs';
export const Config = z.object({
  runtimeDirectory: z.string().default(defaultRuntimeDirectory()).description('Existing shared hub runtime directory; this plugin never starts the service.'),
  vp8UpdateOrigin: z.string().default('').description('Explicit loopback origin for VP8 action updates. Empty disables the controls.'),
});
