import {validatePet4Profile} from './material-profile.mjs';
import {validateRolePackage} from './role-package.mjs';
import { capabilities, compatible, presentation, clone, requireThat, keys, id, digest, bounded, increment, uint64 } from './protocol.mjs';

/** Audited metadata only; importing a catalog does not load files, grant a license or install assets. */
export class MaterialCatalog {
  #variants = new Map();
  constructor(manifests) {
    requireThat(Array.isArray(manifests) && manifests.length > 0 && manifests.length <= 256);
    for (const source of manifests) {
      const m = clone(source);
      keys(m, ['character_id','variant_id','sha256','codec','display','actions','license_ref','package_schema','semantics','pet4_profile']);
      id(m.character_id); id(m.variant_id); digest(m.sha256); id(m.codec);
      requireThat(typeof m.license_ref === 'string' && m.license_ref.trim().length > 0 && m.license_ref.length <= 256);
      keys(m.display, ['width','height','shape','pixel_format']);
      bounded(m.display.width, 1, 8192); bounded(m.display.height, 1, 8192);
      requireThat(['circle','rectangle'].includes(m.display.shape)); id(m.display.pixel_format);validatePet4Profile(m);
      requireThat(Array.isArray(m.actions) && m.actions.length > 0 && m.actions.length <= 256);
      const ids = new Set();
      for (const action of m.actions) {
        keys(action, ['id','bytes','sha256',...(m.package_schema===2?['fps','frames','loop']:[])]); bounded(action.id, 0, 2 ** 32 - 1);
        bounded(action.bytes, 1, 2 ** 31 - 1); digest(action.sha256);
        requireThat(!ids.has(action.id), 'duplicate_action'); ids.add(action.id);
      }
      if(m.package_schema!==undefined||m.semantics!==undefined)validateRolePackage(m);
      const key = this.#key(m.character_id, m.variant_id);
      requireThat(!this.#variants.has(key), 'duplicate_variant');
      this.#variants.set(key, m);
    }
  }
  #key(characterId, variantId) { id(characterId); id(variantId); return `${characterId}:${variantId}`; }
  get(characterId, variantId) {
    const m = this.#variants.get(this.#key(characterId, variantId)); requireThat(m, 'unknown_variant'); return clone(m);
  }
  check(caps, characterId, variantId, requiredActions) {
    const validated = capabilities(caps), manifest = this.get(characterId, variantId);
    const required = requiredActions ?? manifest.actions.map(a => a.id);
    requireThat(Array.isArray(required) && required.length > 0 && required.length <= 256);
    for (const actionId of required) { bounded(actionId, 0, 2 ** 32 - 1); compatible(validated, manifest, actionId); }
    // Check every advertised action too: confirmation selects the whole variant, not a partly compatible pack.
    for (const action of manifest.actions) compatible(validated, manifest, action.id);
    return { manifest, presentation: presentation(validated, manifest) };
  }
  recommend(caps, characterId, requiredActions) {
    capabilities(caps); id(characterId);
    const candidates = [];
    for (const m of this.#variants.values()) {
      if (m.character_id !== characterId) continue;
      try { candidates.push(this.check(caps, characterId, m.variant_id, requiredActions)); }
      catch (e) { if (!['incompatible_asset','unknown_action'].includes(e.code)) throw e; }
    }
    candidates.sort((a,b) => Number(b.presentation.mode === 'exact') - Number(a.presentation.mode === 'exact') ||
      b.manifest.display.width * b.manifest.display.height - a.manifest.display.width * a.manifest.display.height ||
      (a.manifest.variant_id < b.manifest.variant_id ? -1 : a.manifest.variant_id > b.manifest.variant_id ? 1 : 0));
    return { status: candidates.length ? 'confirmation_required' : 'unsupported', recommended: candidates[0] ?? null, candidates };
  }
}

/** Per-device in-memory assignment. A recommendation never modifies it; not a persistence adapter. */
export class MaterialAssignments {
  #catalog; #records = new Map(); #persist;
  constructor(catalog, { records = [], persist = () => {} } = {}) {
    this.#catalog = catalog; this.#persist = persist;
    requireThat(Array.isArray(records) && records.length <= 64);
    for (const record of records) {
      keys(record, ['device_id','revision','selection']); id(record.device_id); uint64(record.revision);
      requireThat(!this.#records.has(record.device_id) && record.revision !== '0');
      const s = record.selection;
      keys(s, ['character_id','variant_id','manifest_sha256','required_actions']);
      id(s.character_id); id(s.variant_id); digest(s.manifest_sha256);
      requireThat(Array.isArray(s.required_actions) && s.required_actions.length > 0 && s.required_actions.length <= 256);
      for (const a of s.required_actions) bounded(a, 0, 2 ** 32 - 1);
      this.#records.set(record.device_id, clone(record));
    }
  }
  records() { return [...this.#records.values()].map(clone); }
  snapshot(deviceId) { id(deviceId); return clone(this.#records.get(deviceId) ?? { device_id: deviceId, revision: '0', selection: null }); }
  confirm({ device_id, expected_revision, character_id, variant_id, manifest_sha256, required_actions }, caps) {
    id(device_id); uint64(expected_revision); digest(manifest_sha256);
    const old = this.snapshot(device_id);
    requireThat(old.revision === expected_revision, 'revision_conflict');
    requireThat(this.#records.has(device_id) || this.#records.size < 64, 'capacity_exceeded');
    const checked = this.#catalog.check(caps, character_id, variant_id, required_actions);
    requireThat(checked.manifest.sha256 === manifest_sha256, 'catalog_changed');
    const result = { device_id, revision: increment(old.revision), selection: { character_id, variant_id, manifest_sha256, required_actions: required_actions ?? checked.manifest.actions.map(a => a.id) } };
    const next = new Map(this.#records); next.set(device_id, clone(result));
    this.#persist([...next.values()].map(clone));
    this.#records = next; return clone(result);
  }
  resolve(deviceId, caps) {
    const record = this.snapshot(deviceId);
    if (!record.selection) return { ...record, status: 'unassigned' };
    const s = record.selection;
    try {
      const checked = this.#catalog.check(caps, s.character_id, s.variant_id, s.required_actions);
      requireThat(checked.manifest.sha256 === s.manifest_sha256, 'catalog_changed');
      return { ...record, status: 'compatible', ...checked };
    } catch (e) {
      if (!['incompatible_asset','unknown_action','unknown_variant','catalog_changed'].includes(e.code)) throw e;
      return { ...record, status: 'unsupported', reason: e.code };
    }
  }
}
