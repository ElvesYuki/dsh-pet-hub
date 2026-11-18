import {Readable} from 'node:stream';
import {native400NodeControlEnvelope,native400NodeControlAck} from '../../packages/core/native400-node-control-access.mjs';
import {native400ReviewEnvelope,native400StartAck,native400CancelAck} from '../../packages/core/native400-review-access.mjs';
import {readNative400ReviewBody,native400ReviewError} from '../../packages/runtime/native400-review-channel.mjs';
import {publicNative400SourceReviewView} from '../../packages/core/native400-source-review-view.mjs';
import {FRAME_RESPONSE_BYTES,SMALL_RESPONSE_BYTES} from '../../packages/core/material-profile.mjs';
import { createHubClient } from '../../packages/runtime/client.mjs';
import {publicObservationView} from '../../packages/core/observation-view.mjs';
import {publicAssemblyView} from '../../packages/core/assembly-view.mjs';
export const name = 'pet-hub';
export const inject = ['webServer'];
export {createDshNodeControlConnection} from './node-control-connection.mjs';

function localListenerOrigin(socket) {
  const {localAddress, localPort, remoteAddress, encrypted} = socket;
  if (remoteAddress !== localAddress || !['127.0.0.1', '::1'].includes(localAddress) ||
      !Number.isInteger(localPort) || localPort < 1 || localPort > 65535) return null;
  return new URL(`${encrypted ? 'https' : 'http'}://${localAddress === '::1' ? '[::1]' : localAddress}:${localPort}`);
}

export function createHostPlugin(client,{reviewAccess,controlAccess,vp8UpdateOrigin,vp8DesktopQuery=false,managedVp8,desktopBattery=false}={}) {
  if (vp8DesktopQuery && vp8UpdateOrigin) throw new Error('choose one VP8 host transport');
  if (managedVp8 && (!vp8DesktopQuery || typeof managedVp8 !== 'function')) throw new Error('invalid managed query provider');
  let reviewOrigin,controlOrigin,vp8Origin;
  const listenerOrigin = vp8UpdateOrigin === 'loopback-listener';
  if (vp8UpdateOrigin && !listenerOrigin) {
    vp8Origin = new URL(vp8UpdateOrigin);
    if (!['http:', 'https:'].includes(vp8Origin.protocol) || !['127.0.0.1', '[::1]'].includes(vp8Origin.hostname) ||
        vp8Origin.origin !== vp8UpdateOrigin) throw new Error('invalid VP8 host origin');
  }
  if(reviewAccess){reviewOrigin=new URL(reviewAccess.origin);if(!['http:','https:'].includes(reviewOrigin.protocol)||!['127.0.0.1','[::1]'].includes(reviewOrigin.hostname)||reviewOrigin.origin!==reviewAccess.origin||typeof reviewAccess.resolve!=='function')throw new Error('invalid review provider');}

  if(controlAccess){controlOrigin=new URL(controlAccess.origin);if(!['http:','https:'].includes(controlOrigin.protocol)||!['127.0.0.1','[::1]'].includes(controlOrigin.hostname)||controlOrigin.origin!==controlAccess.origin||typeof controlAccess.resolve!=='function')throw new Error('invalid control provider');}

  return function apply(ctx) {
    if (vp8DesktopQuery) mountDesktopVp8Query(ctx, client, managedVp8, desktopBattery);
    ctx.effect(() => {
      const active = new Set();let mounted=true;
      const unregister = ctx.webServer.register({
        kind: 'prefix', path: '/dsh-pet-hub',
        async handler(req, res) {
          const controller = new AbortController();
          const abort = () => controller.abort(); res.on('close', abort);
          const cancel = () => { controller.abort(); if (!res.destroyed && !res.writableEnded) { res.writeHead(503); res.end(); } };
          active.add(cancel);
          const reply = (code, value) => {
            if (res.destroyed || res.writableEnded) return;
            let text=JSON.stringify(value);const limit=req.url==='/dsh-pet-hub/roles/frame'?FRAME_RESPONSE_BYTES:SMALL_RESPONSE_BYTES;
            if(Buffer.byteLength(text)>limit){code=503;text=JSON.stringify({error:'response_too_large'});}
            res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(text);
          };
          try {
            const vp8RequestOrigin = listenerOrigin ? localListenerOrigin(req.socket) : vp8Origin;
            if (req.method === 'GET' && req.url === '/dsh-pet-hub/health') return reply(200, { phase: 'P1-scaffold', bleProvisioning: false });
            if (req.method === 'GET' && req.url === '/dsh-pet-hub/status') {
              const result = await client.request('GET', '/v1/status', undefined, { signal: controller.signal });
              let sourceReview;
              if(Object.hasOwn(result,'sourceReview')){sourceReview=publicNative400SourceReviewView(result.sourceReview);if(!sourceReview)throw new Error('invalid source review');}
              // Do not expose service descriptor, token or filesystem paths to the page.
              const vp8Enabled = result.vp8ActionUpdate === true && (vp8DesktopQuery ? result.vp8QueryOnly === true :
                (listenerOrigin ? vp8RequestOrigin?.host === req.headers.host : vp8Origin));
              const vp8DesktopNoCode = vp8Enabled && managedVp8?.()?.instanceId === result.instanceId;
              return reply(200, { ...(vp8Enabled ? {vp8ActionUpdate:true} : {}), ...(vp8DesktopNoCode ? {vp8DesktopNoCode:true} : {}), ...(sourceReview?{sourceReview}:{}),...(result.assemblyReview?{assemblyReview:publicAssemblyView(result.assemblyReview)}:{}),...(result.observationReview?{observationReview:publicObservationView(result.observationReview)}:{}),roles:result.roles,catalog:result.catalog,phase: result.phase, displayName: result.displayName, source: result.source, devices: result.devices, capabilities: result.capabilities, deviceMode: result.deviceMode, synthetic: result.synthetic, simulation: result.simulation, serviceInstanceId: result.instanceId });
            }
            if (['/dsh-pet-hub/vp8-action/status', '/dsh-pet-hub/vp8-action/command'].includes(req.url)) {
              const origin = vp8RequestOrigin;
              if (!origin || !mounted) return reply(404, {error: 'vp8_disabled'});
              const post = req.url.endsWith('/command');
              if (req.method !== (post ? 'POST' : 'GET')) return reply(404, {error: 'vp8_route'});
              if (req.headers.host !== origin.host ||
                  (req.headers.origin !== undefined && req.headers.origin !== origin.origin) ||
                  (req.headers['sec-fetch-site'] !== undefined && req.headers['sec-fetch-site'] !== 'same-origin') ||
                  (post && (req.headers.origin !== origin.origin || req.headers['content-type'] !== 'application/json' ||
                    req.headers['x-pet-hub'] !== '1'))) return reply(403, {error: 'vp8_origin'});
              const reviewToken = req.headers['x-pet-hub-operator'];
              if (typeof reviewToken !== 'string' || !/^[a-f0-9]{32,64}$/.test(reviewToken)) return reply(401, {error:'vp8_unauthorized'});
              try {
                const body = post ? await readNative400ReviewBody(req, {signal: controller.signal}) : undefined;
                if (!mounted || controller.signal.aborted) return;
                if (body?.operation === 'wave') return reply(403, {error: 'vp8_query_only'});
                const result = await client.request(req.method, req.url.replace('/dsh-pet-hub', '/v1'), body,
                  {signal: controller.signal, reviewToken});
                const {revision, phase, compatible, saved, existing, cancellable, error, protocol, device, receipt, ota, upgradeAvailability} = result.update;
                const media2 = protocol === 'media2' ? {protocol, receipt, upgradeAvailability,
                  device: device ? {busy: device.busy, selected: device.selected, slot: device.slot, version: device.version} : null} : {};
                const upgrade = protocol === 'media2' && ota ? {ota: {targetVersion: ota.targetVersion, selectedSeen: ota.selectedSeen,
                  rebootSent: ota.rebootSent, success: ota.success}} : {};
                return reply(200, {instanceId: result.instanceId, update: {revision, phase, compatible, saved, existing, cancellable, error, ...media2, ...upgrade}});
              } catch (error) { return reply([400, 401, 404, 409].includes(error.status) ? error.status : 503, {error: 'vp8_request_rejected'}); }
            }
            const nodeRoute=['/dsh-pet-hub/node-control/controls','/dsh-pet-hub/node-control/command'].includes(req.url);
            if(nodeRoute||['/dsh-pet-hub/source-review/controls','/dsh-pet-hub/source-review/start','/dsh-pet-hub/source-review/cancel'].includes(req.url)){
              const access=nodeRoute?controlAccess:reviewAccess,origin=nodeRoute?controlOrigin:reviewOrigin;
              if(!access||!mounted)return reply(404,{error:'source_review_read_only'});
              const get=req.method==='GET'&&req.url.endsWith('/controls'),post=req.method==='POST'&&!req.url.endsWith('/controls');
              if(!get&&!post)return reply(404,{error:'not found'});
              if(req.headers.host!==origin.host||(req.headers.origin!==undefined&&req.headers.origin!==origin.origin)||(post&&(req.headers.origin!==origin.origin||req.headers['content-type']!=='application/json'||req.headers['x-pet-hub']!=='1'))||(req.headers['sec-fetch-site']!==undefined&&req.headers['sec-fetch-site']!=='same-origin'))return reply(403,{error:'controls_unauthorized'});
              try{
                const scoped=await access.resolve(req,{signal:controller.signal});
                if(!mounted||controller.signal.aborted)return;
                if(!scoped||typeof scoped.request!=='function')return reply(401,{error:'controls_unauthorized'});
                const input=post?await readNative400ReviewBody(req,{signal:controller.signal}):undefined;
                if(!mounted||controller.signal.aborted)return;
                const result=await scoped.request(req.method,req.url.replace('/dsh-pet-hub','/v1'),input,{signal:controller.signal});
                if(!mounted||controller.signal.aborted)return;
                return reply(200,nodeRoute?(get?native400NodeControlEnvelope(result):native400NodeControlAck(result,input)):(get?native400ReviewEnvelope(result):req.url.endsWith('/start')?native400StartAck(result,input):native400CancelAck(result,input)));
              }catch(e){const failure=native400ReviewError({...e,code:e.code??e.message});return reply(failure.status,{error:failure.error});}
            }
            if(req.method==='GET'&&req.url==='/dsh-pet-hub/materials/versions'){
              try{const result=await client.request('GET','/v1/materials/versions',undefined,{signal:controller.signal});return reply(200,{repository:result.repository});}
              catch(e){return reply([400,404,409].includes(e.status)?e.status:503,{error:[400,404,409].includes(e.status)?e.message:'hub unavailable'});}
            }
            if (req.method === 'POST' && ['/dsh-pet-hub/simulation/intent','/dsh-pet-hub/simulation/control','/dsh-pet-hub/materials/selection','/dsh-pet-hub/materials/cleanup','/dsh-pet-hub/roles/activate','/dsh-pet-hub/roles/cancel','/dsh-pet-hub/roles/intent','/dsh-pet-hub/roles/frame','/dsh-pet-hub/roles/retry'].includes(req.url)) {
              if (req.headers['x-pet-hub'] !== '1' || req.headers['content-type'] !== 'application/json') return reply(403,{error:'same-origin JSON required'});
              if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return reply(403,{error:'origin rejected'});
              let text='',size=0;
              for await(const chunk of req) { size+=Buffer.byteLength(chunk); if(size>4096)return reply(413,{error:'body too large'}); text+=chunk; }
              const input=JSON.parse(text),path=req.url.startsWith('/dsh-pet-hub/roles/')?req.url.replace('/dsh-pet-hub','/v1'):req.url.endsWith('/cleanup')?'/v1/materials/cleanup':req.url.endsWith('/selection')?'/v1/materials/selection':req.url.endsWith('/intent')?'/v1/simulation/intent':'/v1/simulation/control';
              try { const result=await client.request('POST',path,input,{signal:controller.signal}); return reply(200,req.url==='/dsh-pet-hub/roles/frame'?{frame:result.frame}:req.url.startsWith('/dsh-pet-hub/roles/')?Object.fromEntries(['job_id','phase','accepted','revision'].filter(k=>Object.hasOwn(result,k)).map(k=>[k,result[k]])):req.url.endsWith('/cleanup')?{accepted:result.accepted,repository:result.repository,removed:result.removed}:{accepted:result.accepted}); }
              catch(e) { return reply([400,404,409].includes(e.status)?e.status:503,{error:[400,404,409].includes(e.status)?e.message:'hub unavailable'}); }
            }
            if (req.method === 'POST' && req.url === '/dsh-pet-hub/source/page') {
              if (req.headers['x-pet-hub'] !== '1' || req.headers['content-type'] !== 'application/json') return reply(403, { error: 'same-origin JSON required' });
              if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return reply(403, { error: 'origin rejected' });
              let text = ''; let size = 0;
              for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > 4096) return reply(413, { error: 'body too large' }); text += chunk; }
              const input = JSON.parse(text);
              const report = Object.fromEntries(['clientId', 'status', 'state', 'counter'].filter(k => Object.hasOwn(input, k)).map(k => [k, input[k]]));
              try { await client.request('POST', '/v1/source/page', report, { signal: controller.signal }); }
              catch (e) { if (e.status === 409) return reply(200, { accepted: false }); throw e; }
              return reply(200, { accepted: true });
            }
            reply(404, { error: 'not found' });
          } catch { reply(503, { error: 'hub unavailable' }); }
          finally { active.delete(cancel); res.off('close', abort); }
        },
      });
      return () => { mounted=false; unregister(); for (const cancel of active) cancel(); active.clear(); };
    }, 'pet-hub: management routes');
  };
}

function mountDesktopVp8Query(ctx, client, managedVp8, desktopBattery) {
  ctx.effect(() => {
    const stop = new AbortController(), disposers = [];
    const close = () => {
      stop.abort();
      for (const dispose of disposers.reverse()) dispose();
    };
    const reply = (status, value) => Response.json(value, {status, headers: {'Cache-Control': 'no-store'}});
    async function dispatch(request, method, path, local) {
      const battery = local && path === 'battery';
      const signal = AbortSignal.any([stop.signal, request.signal, AbortSignal.timeout(battery ? 4500 : 2500)]);
      const url = new URL(request.url);
      const prefix = local ? '/api/pet-hub-vp8-local/' : '/api/pet-hub-vp8/';
      if (request.method !== method || url.pathname !== prefix + path || url.search)
        return reply(404, {error: 'vp8_route'});
      const token = request.headers.get('x-pet-hub-operator');
      if (local ? token !== null : !token || !/^[a-f0-9]{32,64}$/.test(token))
        return reply(401, {error: 'vp8_unauthorized'});
      try {
        signal.throwIfAborted();
        let body;
        if (method === 'POST') {
          if (!request.body || request.headers.get('content-type') !== 'application/json' || request.headers.get('x-pet-hub') !== '1')
            return reply(403, {error: 'vp8_request_rejected'});
          const stream = Readable.fromWeb(request.body, {signal});
          try { body = await readNative400ReviewBody(stream, {signal}); }
          finally { stream.destroy(); }
          if (battery) {
            if (!['sample', 'cancel'].includes(body?.operation)) return reply(403, {error: 'vp8_query_only'});
            const access = managedVp8();
            if (!access?.battery || Object.keys(body).length !== 3 || body.instanceId !== access.instanceId ||
                typeof body.requestId !== 'string' || !/^[a-f0-9]{32}$/.test(body.requestId))
              return reply(409, {error: 'vp8_query_only'});
            signal.throwIfAborted();
            if (body.operation === 'cancel') {
              access.battery.cancel(body.requestId);
              return reply(200, {status: 'cancelled'});
            }
            const result = await access.battery.sample(body.requestId, signal);
            signal.throwIfAborted();
            return reply(200, result);
          }
          if (!(local ? ['query'] : ['query', 'wave']).includes(body?.operation)) return reply(403, {error: 'vp8_query_only'});
          if (!local) {
            const current = await client.request('GET', '/v1/vp8-action/status', undefined, {signal, reviewToken: token});
            if (current.update.queryOnly !== true || body.instanceId !== current.instanceId)
              return reply(409, {error: 'vp8_query_only'});
            if (body.operation === 'wave' && current.update.wave?.available !== true)
              return reply(403, {error: 'vp8_wave_unavailable'});
          }
        }
        signal.throwIfAborted();
      let result, usbStatus, batteryAvailable = false;
        if (local) {
          const access = managedVp8();
          if (!access) return reply(409, {error: 'vp8_managed_owner_unavailable'});
          if (body && (Object.keys(body).length !== 3 || body.instanceId !== access.instanceId ||
              !Number.isSafeInteger(body.revision) || body.revision < 0)) return reply(409, {error: 'vp8_query_only'});
          result = body ? await access.query(body.revision, signal) : await access.status(signal);
          usbStatus = access.usbStatus?.();
          batteryAvailable = desktopBattery && Boolean(access.battery);
        } else result = await client.request(method, '/v1/vp8-action/' + path, body, {signal, reviewToken: token});
        signal.throwIfAborted();
        const {instanceId, update} = result;
        if (update.queryOnly !== true || (local && update.wave)) return reply(409, {error: 'vp8_query_only'});
        const {revision, phase, device, wave} = update;
        return reply(200, {instanceId, update: {revision, phase, protocol: 'media2', queryOnly: true,
          ...(usbStatus ? {...usbStatus, usbContended: update.error === 'usb_busy'} : {}),
          ...(batteryAvailable ? {batteryAvailable: true} : {}),
          ...(local && update.error === 'usb_identity_unavailable' ? {deviceUnavailable: true} : {}),
          ...(wave ? {wave: {available: wave.available, phase: wave.phase, frames: wave.frames,
            returnedIdle: wave.returnedIdle, error: wave.error}} : {}),
          device: device ? {version: device.version, slot: device.slot, selected: device.selected, busy: device.busy} : null}});
      } catch (error) {
        return reply([400, 401, 404, 409].includes(error.status) ? error.status : 503, {error: 'vp8_request_rejected'});
      }
    }
    try {
      const routes = [['GET', 'status', false], ['POST', 'command', false]];
      if (managedVp8) routes.push(['GET', 'status', true], ['POST', 'query', true]);
      if (managedVp8 && desktopBattery) routes.push(['POST', 'battery', true]);
      for (const [method, path, local] of routes) {
        disposers.push(ctx.connection.fetch.register({path: (local ? '/api/pet-hub-vp8-local/' : '/api/pet-hub-vp8/') + path,
          methods: [method], requestBody: method === 'POST' ? 'streaming' : 'buffered',
          fetch: request => dispatch(request, method, path, local)}));
      }
    } catch (error) { close(); throw error; }
    return close;
  }, 'pet-hub: Desktop VP8 query');
}
/** Connect only: unloading the plugin must never stop the shared service. */
export function apply(ctx, config = {}, {managedVp8, desktopBattery} = {}) {
  return createHostPlugin(createHubClient(config.runtimeDirectory),
    {vp8UpdateOrigin: config.vp8UpdateOrigin, vp8DesktopQuery: config.vp8DesktopQuery, managedVp8, desktopBattery})(ctx);
}
