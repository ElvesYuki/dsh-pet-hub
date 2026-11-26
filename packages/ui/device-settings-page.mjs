import {readDesktopNetworkForm, wifiSettingsFields} from './wifi-settings.mjs';
import {weatherSettingsFields} from './weather-settings.mjs';
import {renderDesktopDevice} from './device-settings-view.mjs';

function usbPollingAvailable(update) {
  return update?.batteryAvailable === true && !update.networkStatus &&
    update.usbPresent !== false && update.sameUsbTarget !== false;
}

/** The two owners report independent observations. Never describe an indexed
 * binding as current device evidence, or attribute a mismatched query to it. */
export function desktopDeviceCard({binding, query, bindingError, queryError, battery, clock = 0}) {
  const status = binding?.phase;
  const q = query?.update;
  const tcp = queryError ? null : q?.networkStatus;
  const received = tcp?.lastHeartbeatAt;
  const lastHeartbeatAt = Number.isSafeInteger(received) && received > 0 && received <= 8.64e15 ? received : null;
  const source = tcp ? 'tcp' : q?.usbPresent === false ? 'offline' : q && !queryError ? 'usb' : 'unknown';
  const found = q?.usbPresent === false ? null : q?.usbDevice ?? q?.device;
  const conflict = q?.sameUsbTarget === false;
  const validDevice = found && typeof found.version === 'string' && /^[0-9A-Za-z][0-9A-Za-z._+-]{0,30}$/.test(found.version) &&
    ['ota_0', 'ota_1'].includes(found.slot) ? found : null;
  const device = tcp?.device ?? (q?.sameUsbTarget === true ? validDevice : null);
  const queryResult = q?.phase === 'ready' && q.sameUsbTarget == null && !queryError && !q.deviceUnavailable &&
    !q.usbContended ? validDevice : null;
  const observation = device ?? queryResult;
  const maintenance = observation?.selected ? '已选择启动槽，等待重启。' : observation?.busy ? '设备正在维护。' : null;
  const queryRunning = Boolean(q && ['querying', 'preparing', 'updating', 'cancelling', 'reconnecting'].includes(q.phase));
  const batteryAvailable = Boolean(tcp) || (usbPollingAvailable(q) && !queryError);
  const batteryView = batteryAvailable && battery?.instanceId === query.instanceId ? battery : null;
  const age = batteryView?.sample ? clock - batteryView.sample.at : Infinity;
  const sensorView = batteryView?.sensors;
  const sensorAge = sensorView?.sample ? clock - sensorView.sample.at : Infinity;
  const flags = {
    unregistered: '尚未绑定', preparing: '正在准备绑定', confirming_usb: '正在核对持久绑定',
    recovery_required: '有一笔绑定待核对', reconciling: '正在核对绑定',
    bound: '本地已保存绑定', storage_unavailable: '暂时无法读取本地绑定',
  };
  const issues = {
    usb_unsupported: '当前固件不支持一键绑定。仍可查询设备。',
    unsupported: '当前固件未提供绑定核对。仍可查询设备。',
    usb_not_ready: '设备尚未响应。请确认 USB 已接好，待设备启动后再试。',
    usb_busy: '另一项 USB 操作正在进行，请稍后重试。',
    device_conflict: 'USB 设备或持久绑定与本地记录不匹配。',
    unconfirmed: '未收到可以确认绑定的设备回执。',
    interrupted: '已停止等待，可核对设备上的绑定。',
    transport_unavailable: '无法确认 USB 已释放。',
  };
  const operations = {unregistered: ['绑定设备', 'enroll-usb'], bound: ['验证绑定', 'verify'],
    recovery_required: ['核对绑定', 'recover']};
  const enrollment = binding?.usbEnrollment === true ? operations[status] : undefined;
  const queryStatus = queryRunning ? '正在查询设备' : maintenance ?? (tcp ? null : q?.usbContended ? issues.usb_busy :
    (q?.usbPresent === false || (q?.usbPresent == null && q?.deviceUnavailable)) ? '请连接已登记的 USB 查询设备。' :
      queryError ? '设备查询暂不可用。' :
      q?.phase === 'failed' ? '设备查询未完成，可重试。' :
        q?.phase === 'blocked' ? '设备正在维护或等待启动。' :
          q?.usbBusy && !binding?.busy ? issues.usb_busy :
            q?.phase === 'ready' && (device || queryResult) ? '已读取设备信息' : null);
  return {
    label: flags[status] ?? (bindingError ? '绑定服务暂不可用' : '正在读取绑定状态'),
    evidence: status === 'bound' ? (binding.deviceChecked === true ?
      '本次已从设备核对持久绑定' : '本次尚未从设备核对') : null,
    issue: issues[binding?.issue] ?? null, source, lastHeartbeatAt, queryStatus, conflict, device, queryResult, enrollment,
    batteryAvailable, batteryIndependent: !tcp && batteryAvailable && q.sameUsbTarget !== true,
    batteryStatus: tcp ? (tcp.battery ? 'ok' : 'not_reported') : batteryView?.status,
    batteryReading: tcp ? tcp.battery : age < 15000 ? batteryView.sample : null,
    batteryStale: !tcp && (age >= 7500 || batteryView?.status !== 'ok'),
    sensorStatus: tcp ? (tcp.sensors ? 'ok' : 'not_reported') : sensorView?.status,
    sensorReading: tcp ? tcp.sensors : sensorAge < 15000 ? sensorView.sample : null,
    sensorStale: !tcp && (sensorAge >= 7500 || sensorView?.status !== 'ok'),
    busy: binding?.busy === true || queryRunning || q?.usbBusy === true || Boolean(maintenance),
    canQuery: q?.queryOnly === true, canCancel: binding?.busy === true,
  };
}

export function makeDesktopDevicePage(React, transport) {
  const {createElement: h, useEffect, useRef, useState} = React;
  return function DesktopDevicePage() {
    const [view, setView] = useState({}), [sending, setSending] = useState(false);
    const active = useRef(null);
    useEffect(() => {
      const session = {controller: new AbortController(), generation: 0, sending: false};
      active.current = session;
      let timer, batteryTimer, pending;
      function stopBattery() {
        clearTimeout(batteryTimer);
        batteryTimer = undefined;
        if (pending && !pending.controller.signal.aborted) {
          pending.controller.abort();
          void transport.battery({...pending.input, operation: 'cancel'}).catch(() => {});
        }
      }
      function syncBattery() {
        if (!usbPollingAvailable(session.query?.update)) stopBattery();
        else if (!pending && batteryTimer === undefined) void refreshBattery();
      }
      async function refreshBattery() {
        batteryTimer = undefined;
        const {controller: {signal}, query, binding} = session;
        const update = query?.update;
        if (signal.aborted || !usbPollingAvailable(update)) return;
        if (!session.sending && !binding?.busy && !update.usbBusy &&
            !['querying', 'preparing', 'updating', 'cancelling', 'reconnecting'].includes(update.phase)) {
          const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
            byte.toString(16).padStart(2, '0')).join('');
          const input = {operation: 'sample', instanceId: query.instanceId, requestId};
          const controller = new AbortController();
          pending = {input, controller};
          const requestSignal = AbortSignal.any([signal, controller.signal]);
          let result;
          try { result = await transport.battery(input, requestSignal); }
          catch { result = {status: 'unavailable'}; }
          finally { pending = undefined; }
          if (requestSignal.aborted) {
            if (!signal.aborted) syncBattery();
            return;
          }
          if (result.status !== 'network_active' && session.query?.instanceId === input.instanceId &&
              usbPollingAvailable(session.query.update)) {
            const clock = performance.now();
            setView(old => {
              const previous = old.battery?.instanceId === input.instanceId ? old.battery.sample : null;
              const sample = result.status === 'ok' ? {...result, at: clock} :
                ['busy', 'rate_limited', 'no_reply', 'unavailable'].includes(result.status) ? previous : null;
              const {sensors} = result;
              const previousSensors = old.battery?.instanceId === input.instanceId ? old.battery.sensors?.sample : null;
              const previousAllowed = ['busy', 'rate_limited', 'unavailable'].includes(sensors?.status ?? result.status);
              const sensorSample = sensors?.status === 'ok' ? {...sensors, at: clock} : previousAllowed ? previousSensors : null;
              return {...old, clock, battery: {instanceId: input.instanceId, status: result.status, sample,
                sensors: {status: sensors?.status ?? result.status, sample: sensorSample}}};
            });
          }
        }
        if (!signal.aborted && usbPollingAvailable(session.query?.update))
          batteryTimer = setTimeout(refreshBattery, 5000);
      }
      async function refresh() {
        const generation = session.generation;
        if (!session.sending) {
          const signal = session.controller.signal;
          const results = await Promise.allSettled([transport.binding(signal), transport.query(signal)]);
          if (!signal.aborted && generation === session.generation) {
            const [binding, query] = results;
            const failed = result => result.status !== 'fulfilled';
            session.binding = binding.value ?? null;
            session.query = query.value ?? null;
            const clock = performance.now();
            setView(old => ({...old, binding: binding.value ?? null, query: query.value ?? null,
              bindingError: failed(binding), queryError: failed(query), clock,
              battery: session.query?.instanceId === old.battery?.instanceId &&
                usbPollingAvailable(session.query?.update) ? old.battery : null}));
            if (pending && pending.input.instanceId !== session.query?.instanceId) stopBattery();
            syncBattery();
          }
        }
        if (!session.controller.signal.aborted) timer = setTimeout(refresh, 650);
      }
      void refresh();
      return () => {
        stopBattery();
        session.controller.abort();
        clearTimeout(timer);
        active.current = null;
      };
    }, []);

    const card = desktopDeviceCard(view);
    const network = view.network?.instanceId === view.binding?.instanceId ? view.network : null;
    const weather = view.weather?.instanceId === view.binding?.instanceId ? view.weather : null;
    const lookup = view.weatherLookup;

    async function searchWeather(raw) {
      const session = active.current;
      if (!session || view.binding?.weatherAvailable !== true) return;
      session.weatherSearch?.abort();
      session.weatherSearch = undefined;
      const name = raw.trim(), length = [...name].length;
      if (length < 2 || length > 80) {
        setView(old => ({...old, weatherLookup: {state: 'invalid'}}));
        return;
      }
      const search = new AbortController();
      session.weatherSearch = search;
      const signal = AbortSignal.any([search.signal, session.controller.signal]);
      setView(old => ({...old, weatherLookup: {state: 'loading'}}));
      let next;
      try {
        const {places} = await transport.searchWeather(name, signal);
        next = {state: places.length ? 'ready' : 'empty', places};
      } catch { next = {state: 'failed'}; }
      if (!signal.aborted && session.weatherSearch === search) {
        session.weatherSearch = undefined;
        setView(old => ({...old, weatherLookup: next}));
      }
    }

    async function weatherCommand(operation) {
      const session = active.current, source = view.binding, place = lookup?.selected;
      if (!session || session.sending || card.busy || card.conflict || source?.phase !== 'bound' || !source.weatherAvailable ||
          (operation === 'set' && !place) || (operation === 'clear' && !weather?.info?.configured) ||
          (operation !== 'info' && (weather?.needsReadback || ['unsupported', 'backend_missing'].includes(weather?.result?.status)))) return;
      const {signal} = session.controller;
      session.sending = true;
      session.generation++;
      setSending(true);
      let result = {status: 'unavailable'}, sent = false;
      try {
        const fresh = await transport.binding(signal);
        if (fresh.instanceId !== source.instanceId || fresh.phase !== 'bound' || !fresh.weatherAvailable || fresh.busy) {
          result = {status: 'state_changed'};
        } else {
          const coordinates = operation === 'set' ? {latitudeE4: place.latitudeE4, longitudeE4: place.longitudeE4} : {};
          sent = true;
          result = await transport.weather({operation, instanceId: fresh.instanceId, revision: fresh.revision, ...coordinates}, signal);
        }
      } catch { result = {status: sent && operation !== 'info' ? 'unknown' : 'unavailable'}; }
      finally {
        session.sending = false;
        if (!signal.aborted) {
          const info = ['ok', 'saved', 'cleared'].includes(result.status) ? result :
            ['invalid', 'busy', 'storage_failed'].includes(result.status) ? weather?.info : null;
          const needsReadback = ['unknown', 'state_changed'].includes(result.status) ||
            (weather?.needsReadback === true && !(operation === 'info' && result.status === 'ok'));
          setView(old => ({...old, weather: {instanceId: source.instanceId, result, info, needsReadback}}));
          setSending(false);
        }
      }
    }
    async function networkCommand(operation, form, ssidHex) {
      const session = active.current, source = view.binding;
      if (!session || session.sending || card.busy || card.conflict || source?.phase !== 'bound' ||
          !source.networkAvailable || (operation !== 'info' && (!network?.checked || network.info?.readOnly))) return;
      const profiles = network?.info?.version === 3;
      if (operation === 'remove' && (!profiles || !network.info.profiles.some(profile => profile.id === ssidHex))) return;
      if (operation === 'clear' && profiles) return;
      if (operation === 'clear') form.elements.namedItem('password').value = '';
      const settings = operation === 'set' ? readDesktopNetworkForm(form) : null;
      if (operation === 'set' && !settings) {
        setView(old => ({...old, network: {...network, result: {status: 'invalid'}}}));
        return;
      }
      const password = settings?.password ?? new Uint8Array(0);
      const {signal} = session.controller;
      session.sending = true;
      session.generation++;
      setSending(true);
      let result, sent = false;
      try {
        const fresh = await transport.binding(signal);
        if (fresh.instanceId !== source.instanceId || fresh.phase !== 'bound' || !fresh.networkAvailable || fresh.busy) {
          result = {status: 'state_changed'};
        } else {
          signal.throwIfAborted();
          const input = {operation, instanceId: fresh.instanceId, revision: fresh.revision, ...settings?.config,
            ...(operation === 'info' || profiles ? {version: 3} : {}), ...(operation === 'remove' ? {ssidHex} : {})};
          sent = true;
          result = await transport.network(input, password, signal);
        }
      } catch { result = {status: sent && operation !== 'info' ? 'unknown' : 'unavailable'}; }
      finally {
        password.fill(0);
        session.sending = false;
        if (!signal.aborted) {
          const retainInfo = ['invalid', 'busy', 'storage_failed'].includes(result.status);
          const listConfirmed = result.version === 3 && ['saved', 'removed'].includes(result.status);
          const info = result.status === 'ok' || listConfirmed ? result : retainInfo ? network?.info : null;
          setView(old => ({...old, network: {instanceId: source.instanceId, result, info, checked: Boolean(info)}}));
          setSending(false);
        }
      }
    }
    async function command(operation) {
      const session = active.current;
      const cancel = operation === 'cancel', query = operation === 'query';
      if (!session || session.sending || (card.busy && !cancel)) return;
      const source = query ? view.query : view.binding;
      if (!source || (query ? !card.canQuery : cancel ? !card.canCancel : card.enrollment?.[1] !== operation)) return;
      const revision = query ? source.update.revision : source.revision;
      session.sending = true;
      session.generation++;
      setSending(true);
      setView(old => ({...old, commandError: null}));
      const input = {operation, instanceId: source.instanceId, revision};
      const signal = session.controller.signal;
      try {
        const next = await (query ? transport.readDevice(input, signal) : transport.bindingCommand(input, signal));
        if (!signal.aborted) {
          const key = query ? 'query' : 'binding';
          session[key] = next;
          setView(old => ({...old, [key]: next}));
        }
      } catch {
        if (!signal.aborted) setView(old => ({...old, commandError: '请求未确认，正在重新读取状态。'}));
      } finally {
        session.sending = false;
        if (!signal.aborted) setSending(false);
      }
    }

    const blocked = sending || card.busy || card.conflict;
    const bound = view.binding?.phase === 'bound';
    const networkFields = transport.network && bound ? wifiSettingsFields(h, {network, blocked,
      capable: view.binding.networkAvailable === true, command: networkCommand}) : null;
    const weatherFields = transport.weather && (view.binding?.weatherAvailable || bound) ?
      weatherSettingsFields(h, {capable: view.binding.weatherAvailable === true, bound, blocked,
        device: weather, lookup, search: searchWeather, command: weatherCommand,
        choose: place => setView(old => old.weatherLookup?.places?.includes(place) ?
          {...old, weatherLookup: {...old.weatherLookup, selected: place}} : old)}) : null;
    return renderDesktopDevice(h, {card, sending, command, commandError: view.commandError,
      network: networkFields, weather: weatherFields, motion: transport.TaskSources ? h(transport.TaskSources) : null});
  };
}
