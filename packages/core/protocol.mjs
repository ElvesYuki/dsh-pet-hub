export const MAX_U64 = (1n << 64n) - 1n;
export const clone = value => structuredClone(value);
export function fail(code) { throw Object.assign(new Error(code), { code }); }
export function requireThat(condition, code = 'invalid_message') { if (!condition) fail(code); }
export function uint64(value) {
  requireThat(typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value));
  const n = BigInt(value); requireThat(n <= MAX_U64); return n;
}
export function increment(value) { const n = uint64(value); requireThat(n < MAX_U64, 'sequence_exhausted'); return String(n + 1n); }
export function id(value) { requireThat(typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value)); return value; }
export function digest(value) { requireThat(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)); return value; }
export function bounded(value, min, max) { requireThat(Number.isSafeInteger(value) && value >= min && value <= max); return value; }
export function keys(value, allowed) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value));
  requireThat(Object.keys(value).every(k => allowed.includes(k)));
}
export function frame(value) {
  const visit = (v, depth) => {
    requireThat(depth <= 8);
    if (v && typeof v === 'object') for (const child of Object.values(v)) visit(child, depth + 1);
  };
  visit(value, 0);
  requireThat(new TextEncoder().encode(JSON.stringify(value)).length <= 16384);
  if (value?.extensions) requireThat(new TextEncoder().encode(JSON.stringify(value.extensions)).length <= 1024);
  return value;
}
export function capabilities(value) {
  keys(value, ['schema_version','protocols','codecs','firmware_version','board_profile','display','cache','max_asset_bytes','inputs','outputs','max_downloads','presentation_modes','extensions']);
  frame(value); requireThat([1,2].includes(value.schema_version), 'unsupported_protocol');
  requireThat(Array.isArray(value.protocols) && value.protocols.includes('hub-device/1'), 'unsupported_protocol');
  requireThat(Array.isArray(value.codecs) && value.codecs.every(v => typeof v === 'string'));
  keys(value.display, ['width','height','shape','pixel_format']);
  bounded(value.display.width, 1, 8192); bounded(value.display.height, 1, 8192);
  requireThat(['circle','rectangle'].includes(value.display.shape) && typeof value.display.pixel_format === 'string');
  if (value.schema_version === 1) {
    requireThat(value.presentation_modes === undefined);
    keys(value.cache, ['slots','slot_bytes','persistent']);
    bounded(value.cache.slots, 1, 64); bounded(value.cache.slot_bytes, 1, 2 ** 31 - 1);
    requireThat(typeof value.cache.persistent === 'boolean'); bounded(value.max_asset_bytes, 1, value.cache.slot_bytes);
  } else {
    requireThat(Array.isArray(value.presentation_modes) && value.presentation_modes.length > 0 && value.presentation_modes.length <= 2 &&
      new Set(value.presentation_modes).size === value.presentation_modes.length && value.presentation_modes.every(v => ['exact','center'].includes(v)));
    keys(value.cache, ['playback_bytes','persistent']);
    bounded(value.cache.playback_bytes, 1, 2 ** 31 - 1);
    bounded(value.max_asset_bytes, 1, value.cache.playback_bytes);
    if (value.cache.persistent !== null) {
      keys(value.cache.persistent, ['active_slots','staging_slots','slot_bytes']);
      bounded(value.cache.persistent.active_slots, 1, 64); bounded(value.cache.persistent.staging_slots, 1, 64);
      bounded(value.cache.persistent.slot_bytes, 1, 2 ** 31 - 1);
    }
  }
  bounded(value.max_downloads, 1, 1);
  for (const list of [value.inputs,value.outputs]) requireThat(Array.isArray(list) && list.length <= 32 && list.every(v => typeof v === 'string' && v.length <= 80));
  id(value.firmware_version); id(value.board_profile);
  return clone(value);
}
/** No scaling/cropping. Physical display and asset geometry are distinct. */
export function presentation(caps, manifest) {
  const screen = caps.display, asset = manifest.display;
  requireThat(screen.shape === asset.shape && screen.pixel_format === asset.pixel_format, 'incompatible_asset');
  const exact = screen.width === asset.width && screen.height === asset.height;
  const mode = exact ? 'exact' : 'center';
  const allowed = caps.schema_version === 1 ? ['exact'] : caps.presentation_modes;
  requireThat(allowed?.includes(mode) && asset.width <= screen.width && asset.height <= screen.height, 'incompatible_asset');
  return { mode, x: Math.floor((screen.width - asset.width) / 2), y: Math.floor((screen.height - asset.height) / 2) };
}
export function compatible(caps, manifest, actionId) {
  const action = manifest.actions.find(a => a.id === actionId);
  requireThat(action, 'unknown_action');
  presentation(caps, manifest);
  requireThat(caps.codecs.includes(manifest.codec) && Number.isSafeInteger(action.bytes) && action.bytes > 0 && action.bytes <= caps.max_asset_bytes, 'incompatible_asset');
  if (caps.schema_version === 2) {
    requireThat(action.bytes <= caps.cache.playback_bytes, 'incompatible_asset');
    if (caps.cache.persistent !== null) requireThat(action.bytes <= caps.cache.persistent.slot_bytes, 'incompatible_asset');
  }
  return clone(action);
}
export function target(value, manifest, caps) {
  keys(value, ['command_id','revision','character_id','manifest_sha256','variant_id','action_id','asset_sha256']);
  id(value.command_id); uint64(value.revision); bounded(value.action_id, 0, 2 ** 32 - 1);
  requireThat(value.character_id === manifest.character_id && digest(value.manifest_sha256) === manifest.sha256 && value.variant_id === manifest.variant_id, 'incompatible_asset');
  const action = compatible(caps, manifest, value.action_id);
  requireThat(digest(value.asset_sha256) === action.sha256, 'incompatible_asset');
  return action;
}
export function same(a,b) {
  const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k,canonical(v[k])])) : v;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
