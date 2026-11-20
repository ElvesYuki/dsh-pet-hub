export function makeDeviceUpdatePanel(React, transport) {
  const {createElement: h, useEffect, useRef, useState} = React;
  const labels = {idle: '等待查询', querying: '正在查询', preparing: '准备更新', updating: '设备正在更新',
    cancelling: '等待设备取消', cancelled: '已取消', failed: '更新或查询失败', unknown: '结果未知，请查询设备',
    not_saved: '设备尚未保存', saved: '设备已保存', ready: '已读取固件状态，素材库存未知', blocked: '设备正在维护或等待启动',
    reconnecting: '正在重连并核对运行版本', upgraded: '设备已升级'};
  const upgradeLabels = {unavailable: '暂无可信固件发布，升级不可用。', query_required: '请先查询设备。',
    device_busy: '设备维护中或等待启动，暂不能升级。', current: '已是发布版本。', ineligible: '此发布未批准从当前固件升级。',
    reconcile_required: '上次升级结果未知，请先查询设备。'};
  const waveLabels = {idle: '可手动测试一次已缓存的挥手动作。', checking: '正在核对设备状态。',
    awaiting: '正在等待挥手首帧。', playing: '已显示挥手首帧，正在播放。',
    returning: '挥手已完整播放 241 帧，正在等待待机首帧。',
    complete: '挥手已播放 241 帧，已恢复待机。',
    rejected: '挥手未执行，设备状态或连接检查未通过。', unknown: '未能确认完整挥手和待机恢复。'};
  return function DeviceUpdatePanel({serviceInstanceId,noCode=false}) {
    const [token, setToken] = useState(''), [view, setView] = useState(null), [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const session = useRef(null);
    useEffect(() => {
      setView(null);
      setError('');
      setPending(false);
      if (!noCode && !/^[a-f0-9]{32,64}$/.test(token)) return;
      const controller = new AbortController();
      const active = {controller, token, noCode, pending: false};
      session.current = active;
      let timer;
      async function poll() {
        try {
          const next = await (noCode ? transport.localDeviceStatus(controller.signal) : transport.deviceUpdateStatus(token, controller.signal));
          if (!controller.signal.aborted && next.instanceId === serviceInstanceId) {
            setView(previous => previous && previous.revision > next.update.revision ? previous : next.update);
            setError('');
          }
        } catch (reason) {
          if (!controller.signal.aborted) {
            setView(null);
            setError(reason.status === 401 ? '授权码未通过。' : '无法读取更新状态。');
          }
        }
        if (!controller.signal.aborted) timer = setTimeout(poll, 800);
      }
      void poll();
      return () => { controller.abort(); clearTimeout(timer); session.current = null; };
    }, [noCode, token, serviceInstanceId]);

    async function command(operation) {
      const active = session.current;
      if (!active || active.pending || !view || (active.noCode && operation !== 'query')) return;
      const {signal} = active.controller;
      active.pending = true;
      setPending(true);
      try {
        const report = {operation, instanceId: serviceInstanceId, revision: view.revision};
        const next = await (active.noCode ? transport.localDeviceQuery(report, signal) : transport.deviceUpdateCommand(active.token, report, signal));
        if (!signal.aborted && next.instanceId === serviceInstanceId)
          setView(previous => previous && previous.revision > next.update.revision ? previous : next.update);
      } catch {
        if (!signal.aborted) setError('请求未确认，请核对设备状态。');
      } finally {
        if (!signal.aborted) { active.pending = false; setPending(false); }
      }
    }
    const wave = view?.wave;
    const running = ['querying', 'preparing', 'updating', 'cancelling', 'reconnecting'].includes(view?.phase) ||
      ['checking', 'awaiting', 'playing', 'returning'].includes(wave?.phase);
    const media2 = view?.protocol === 'media2';
    const queryOnly = noCode || view?.queryOnly === true;
    const device = view?.device;
    const upgradeAvailability = view?.upgradeAvailability ?? 'unavailable';
    const installDisabled = pending || running || !view || (media2 ? !device || device.busy || device.selected :
      view.phase === 'unknown' || view.saved === true);
    const status = view?.deviceUnavailable ? '请连接已登记的设备。新设备需要先登记。' :
      view?.phase === 'upgraded' && view.ota?.success === true ? `已升级到 ${view.ota.targetVersion}` :
      view?.phase === 'upgraded' || (view?.phase === 'saved' && view.saved !== true) ? labels.unknown :
      media2 && !view.ota && view?.phase === 'unknown' ? '结果未知，可手动重新安装以取得设备回执' : labels[view?.phase];
    return h('section', {'aria-label': queryOnly ? '设备查询' : '动画更新'},
      h('h3', null, queryOnly ? '设备查询' : '动画更新'),
      noCode ? null : h('label', null, '本地授权码', h('input', {type: 'password', autoComplete: 'off', maxLength: 64,
        value: token, onChange: event => setToken(event.target.value)})),
      view ? h('p', {role: 'status'}, status) : null,
      device ? h('p', null, `固件 ${device.version} · 当前槽 ${device.slot}`) : null,
      media2 && !queryOnly && !running && upgradeLabels[upgradeAvailability] ? h('p', null, upgradeLabels[upgradeAvailability]) : null,
      error ? h('p', {role: 'alert'}, error) : null,
      h('button', {type: 'button', disabled: pending || running || !view, onClick: () => command('query')}, '查询设备'),
      wave ? h('p', {role: 'status'}, wave.error === 'wave_timeout' ? '等待设备回执超时，挥手结果未知。' : waveLabels[wave.phase]) : null,
      wave ? h('button', {type: 'button', disabled: pending || running || !wave.available, onClick: () => command('wave')}, '挥手测试') : null,
      queryOnly || !view ? null : h('button', {type: 'button', disabled: installDisabled, onClick: () => command('install')},
        media2 && view.saved ? '重新核验素材' : '安装素材'),
      view?.ota ? h('button', {type: 'button', disabled: pending || running || upgradeAvailability !== 'available',
        onClick: () => command('upgrade')}, `升级到 ${view.ota.targetVersion}`) : null,
      view?.cancellable ? h('button', {type: 'button', disabled: pending, onClick: () => command('cancel')}, '取消更新') : null);
  };
}
