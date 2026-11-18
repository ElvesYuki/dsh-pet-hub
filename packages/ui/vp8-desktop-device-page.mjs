/** The two owners report independent observations. Never describe an indexed
 * binding as current device evidence, or attribute a mismatched query to it. */
export function desktopDeviceCard({binding, query, bindingError, queryError, battery, clock = 0}) {
  const status = binding?.phase;
  const q = query?.update;
  const found = q?.device;
  const conflict = q?.sameUsbTarget === false;
  const validDevice = found && typeof found.version === 'string' && /^[0-9A-Za-z][0-9A-Za-z._+-]{0,30}$/.test(found.version) &&
    ['ota_0', 'ota_1'].includes(found.slot) ? found : null;
  const device = q?.sameUsbTarget === true ? validDevice : null;
  const queryResult = q?.phase === 'ready' && q.sameUsbTarget == null && !queryError && !q.deviceUnavailable &&
    !q.usbContended ? validDevice : null;
  const queryRunning = Boolean(q && ['querying', 'preparing', 'updating', 'cancelling', 'reconnecting'].includes(q.phase));
  const batteryAvailable = q?.batteryAvailable === true && !conflict && !queryError;
  const batteryView = batteryAvailable && battery?.instanceId === query.instanceId ? battery : null;
  const age = batteryView?.sample ? clock - batteryView.sample.at : Infinity;
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
  const queryStatus = queryRunning ? '正在查询设备' : q?.usbContended ? issues.usb_busy :
    q?.deviceUnavailable ? '请连接已登记的 USB 查询设备。' : queryError ? '设备查询暂不可用。' :
      q?.phase === 'failed' ? '设备查询未完成，可重试。' :
        q?.phase === 'blocked' ? '设备正在维护或等待启动。' :
          q?.usbBusy && !binding?.busy ? issues.usb_busy :
            q?.phase === 'ready' && (device || queryResult) ? '已读取设备信息' : null;
  return {
    label: flags[status] ?? (bindingError ? '绑定服务暂不可用' : '正在读取绑定状态'),
    evidence: status === 'bound' ? (binding.deviceChecked === true ?
      '本次已从设备核对持久绑定' : '本次尚未从设备核对') : null,
    issue: issues[binding?.issue] ?? null, queryStatus, conflict, device, queryResult, enrollment,
    batteryAvailable, batteryIndependent: batteryAvailable && q.sameUsbTarget !== true,
    batteryStatus: batteryView?.status, batteryReading: age < 15000 ? batteryView.sample : null,
    batteryStale: age >= 7500 || batteryView?.status !== 'ok',
    busy: binding?.busy === true || queryRunning || q?.usbBusy === true,
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
      let timer, batteryTimer, batteryStarted = false;
      async function refreshBattery() {
        const {controller: {signal}, query, binding} = session;
        const update = query?.update;
        if (!signal.aborted && !session.sending && !binding?.busy && update?.batteryAvailable === true &&
            update.sameUsbTarget !== false && !update.usbBusy &&
            !['querying', 'preparing', 'updating', 'cancelling', 'reconnecting'].includes(update.phase)) {
          const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
            byte.toString(16).padStart(2, '0')).join('');
          const input = {operation: 'sample', instanceId: query.instanceId, requestId};
          session.batteryRequest = input;
          let result;
          try { result = await transport.battery(input, signal); }
          catch { result = {status: 'unavailable'}; }
          finally { session.batteryRequest = null; }
          if (!signal.aborted && session.query?.instanceId === input.instanceId &&
              session.query?.update?.sameUsbTarget !== false) {
            const clock = performance.now();
            setView(old => {
              const previous = old.battery?.instanceId === input.instanceId ? old.battery.sample : null;
              const sample = result.status === 'ok' ? {...result, at: clock} :
                ['busy', 'rate_limited', 'no_reply', 'unavailable'].includes(result.status) ? previous : null;
              return {...old, clock, battery: {instanceId: input.instanceId, status: result.status, sample}};
            });
          }
        }
        if (!signal.aborted) batteryTimer = setTimeout(refreshBattery, 5000);
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
                session.query?.update?.sameUsbTarget !== false ? old.battery : null}));
            if (!batteryStarted && session.query?.update?.batteryAvailable === true) {
              batteryStarted = true;
              void refreshBattery();
            }
          }
        }
        if (!session.controller.signal.aborted) timer = setTimeout(refresh, 650);
      }
      void refresh();
      return () => {
        const pending = session.batteryRequest;
        session.controller.abort();
        clearTimeout(timer);
        clearTimeout(batteryTimer);
        active.current = null;
        if (pending) void transport.battery({...pending, operation: 'cancel'}).catch(() => {});
      };
    }, []);

    const card = desktopDeviceCard(view);
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

    const button = (label, operation, disabled, primary = false) => h('button', {type: 'button',
      disabled, onClick: () => command(operation), style: {minHeight: 36, padding: '6px 13px', font: 'inherit',
        fontWeight: primary ? 600 : 400, border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
        borderRadius: 8, background: primary ? 'color-mix(in srgb, currentColor 10%, transparent)' : 'transparent',
        color: 'inherit', opacity: disabled ? 0.55 : 1}}, label);
    const line = (label, value) => h('div', null, h('dt', {style: {opacity: 0.7, fontSize: '0.85em'}}, label),
      h('dd', {style: {margin: '3px 0 0', fontWeight: 500, overflowWrap: 'anywhere'}}, value));
    const field = {margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px'};
    const sample = card.batteryReading;
    const flow = {standby: '待机', charging: '充电中', discharging: '放电中', unknown: '未知'};
    const phase = {trickle: '滴流', precharge: '预充', cc: '恒流', cv: '恒压', full: '充电完成', idle: '未充电', unknown: '未知阶段'};
    const batteryStatus = {busy: 'USB 或设备忙，等待下次采样。', rate_limited: '查询受限，等待下次采样。',
      no_reply: '电池查询无响应，固件可能不支持。', unavailable: '电池读取暂不可用。',
      disconnected: '已登记的 USB 设备未连接。', conflict: 'USB 目标关系已变化。'};
    const batteryFields = card.batteryAvailable ? h('div', {'aria-label': '电池'},
      sample ? h('dl', {style: field},
        line('电量', !sample.present ? '未检测到电池' : sample.percent == null ? '不可用' : sample.percent + '%'),
        line('电压', sample.mv == null ? '不可用' : sample.mv + ' mV'),
        line('充电状态', sample.present ? flow[sample.flow] + ' · ' + phase[sample.phase] : '无电池'),
        line('USB 供电', sample.usbPower ? '有输入' : '无输入')) : null,
      card.batteryStale && sample ? h('p', null, '上次读取，当前读数待更新。') : null,
      batteryStatus[card.batteryStatus] ? h('p', null, batteryStatus[card.batteryStatus]) :
        !sample ? h('p', null, card.batteryStatus === 'ok' ? '电池读数已过时。' : '等待读取电池。') : null) : null;
    return h('section', {'aria-label': '桌面宠物设备', style: {maxWidth: 720}},
      h('article', {style: {border: '1px solid color-mix(in srgb, currentColor 18%, transparent)', borderRadius: 12,
        padding: '18px', display: 'grid', gap: 16}},
      h('header', {style: {display: 'grid', gap: 4}},
        h('h3', {style: {margin: 0, fontSize: 17}}, '1.75C-EN'),
        h('p', {style: {margin: 0, opacity: 0.7}}, 'USB 直连')),
      h('dl', {style: field}, line('绑定', card.label),
        card.queryResult ? null : line('固件', card.device?.version ?? '尚未查询'),
        card.queryResult ? null : line('启动槽', card.device?.slot ?? '尚未查询')),
      card.batteryIndependent ? null : batteryFields,
      card.queryResult || card.batteryIndependent ? h('section', {'aria-label': 'USB 查询结果', style: {display: 'grid', gap: 8}},
        h('h4', {style: {margin: 0}}, 'USB 查询结果'),
        h('p', {style: {margin: 0, opacity: 0.7}}, '与绑定目标的关系待核对。'),
        card.queryResult ? h('dl', {style: field}, line('固件', card.queryResult.version), line('启动槽', card.queryResult.slot)) : null,
        card.batteryIndependent ? batteryFields : null) : null,
      h('div', {role: 'status', 'aria-live': 'polite', style: {display: 'grid', gap: '4px'}},
        card.evidence ? h('span', null, card.evidence) : null,
        card.queryStatus ? h('span', null, card.queryStatus) : null,
        card.conflict ? h('span', null, '绑定与查询的 USB 设备不同。查询结果暂不显示。') : null,
        card.issue ? h('span', null, card.issue) : null),
      view.commandError ? h('p', {role: 'alert', style: {margin: 0}}, view.commandError) : null,
      h('div', {style: {display: 'flex', flexWrap: 'wrap', gap: 8}},
        card.enrollment ? button(...card.enrollment, sending || card.busy, true) : null,
        button('查询设备', 'query', sending || card.busy || !card.canQuery, !card.enrollment),
        card.canCancel ? button('停止等待', 'cancel', sending) : null)));
  };
}
