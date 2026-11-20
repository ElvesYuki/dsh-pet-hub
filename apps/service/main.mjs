import { parseArgs } from 'node:util';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { startOrAttach } from '../../packages/runtime/index.mjs';
import { prepareDeviceUpdate } from '../../packages/runtime/device-update.mjs';
import { loadTrustedRelease } from '../../packages/runtime/firmware-release.mjs';
const { values } = parseArgs({ options: { 'runtime-dir': { type: 'string' }, 'device-mode': { type: 'string', default: 'disabled' }, 'source-mode': { type: 'string', default: 'disabled' }, 'pet-base': { type: 'string' }, 'material-quota-bytes':{type:'string'},'material-mode':{type:'string',default:'snapshot'},'materials-dir':{type:'string'},'materials-sha256':{type:'string'},'material-license':{type:'string',multiple:true},'material-profile':{type:'string',multiple:true},'device-update-config':{type:'string'} } });
if(values['material-profile']?.some(p=>p!=='native400-candidate-v1')||values['material-profile']&&!values['materials-dir'])throw new Error('explicit material profile requires source and supported profile');
if (!['snapshot','streaming'].includes(values['material-mode'])) throw new Error('invalid material mode');
if (!values['runtime-dir']) throw new Error('--runtime-dir is required; use a private isolated directory for testing');
const simulationFactory = values['device-mode'] === 'simulation' ? (await import('../../packages/simulator/session.mjs')).createSimulation : undefined;
if ((values['materials-dir'] || values['materials-sha256'] || values['material-license']) && !(values['materials-dir'] && values['materials-sha256'] && values['material-license']?.length)) throw new Error('material import requires directory, trusted index SHA256 and approved license refs');
const materialImport=values['materials-dir']?{mode:values['material-mode'],directory:values['materials-dir'],indexSha256:values['materials-sha256'],approvedLicenses:values['material-license'],...(values['material-profile']?{approvedPet4Profiles:values['material-profile']}: {})}:undefined;
async function readDeviceUpdateConfig(path) {
  if (!isAbsolute(path)) throw new Error('device_config_path');
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const bytes = Buffer.alloc(4097);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || stat.nlink !== 1 || (stat.mode & 0o077) || stat.size > 4096)
      throw new Error('device_config_permissions');
    let size = 0;
    while (size < bytes.length) {
      const {bytesRead} = await file.read(bytes, size, bytes.length - size, size);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > 4096) throw new Error('device_config_size');
    let config;
    try { config = JSON.parse(bytes.toString('utf8', 0, size)); }
    catch { throw new Error('device_config_json'); }
    const {releaseSource, ...options} = config;
    options.release = options.protocol === 'media2' ? await loadTrustedRelease(releaseSource) : undefined;
    return prepareDeviceUpdate(options);
  } finally { bytes.fill(0); await file.close(); }
}
const deviceUpdate = values['device-update-config'] ? await readDeviceUpdateConfig(values['device-update-config']) : undefined;
const service = await startOrAttach({ directory: values['runtime-dir'], deviceMode: values['device-mode'], simulationFactory, materialImport, deviceUpdate, materialQuotaBytes:values['material-quota-bytes']===undefined?1073741824:Number(values['material-quota-bytes']), source: { mode: values['source-mode'], base: values['pet-base'] } });
console.log(JSON.stringify({ role: service.role, instanceId: service.instanceId }));
if (service.role === 'owner') {
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
    if (stopping) return; stopping = true;
    await service.close(); process.exitCode = 0;
  });
}
