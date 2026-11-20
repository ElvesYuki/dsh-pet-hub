export function makeEnrollmentSettings(React, {enrollmentStatus, enrollmentCommand}) {
  const {createElement: h, useEffect, useRef, useState} = React;
  const labels = {unregistered: '等待登记', preparing: '正在准备登记',
    confirming_usb: '正在核对设备持久绑定回执。',
    awaiting_boot: '请在设备提示后短按并松开 BOOT。', reconciling: '正在核对设备绑定',
    recovery_required: '登记结果未知，请重新核对同一设备。', bound: '本地已保存绑定。',
    storage_unavailable: '无法读取私有登记。'};
  const issues = {unsupported: '当前设备尚未提供 BOOT 登记能力。',
    usb_unsupported: '当前固件不支持 USB 一键绑定。', device_conflict: '设备或绑定身份不匹配。',
    usb_not_ready: 'USB 设备尚未响应。确认接线并等待设备启动后，可再试一次。',
    interrupted: '等待已停止，请核对设备状态。', unconfirmed: '未取得可确认的设备回执。',
    transport_unavailable: '无法确认连接已关闭，请关闭候选后重新检查。'};
  return function EnrollmentSettings() {
    const [view, setView] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const session = useRef(null);
    useEffect(() => {
      const controller = new AbortController();
      const active = {controller, busy: false, generation: 0};
      session.current = active;
      let timer;
      async function refresh() {
        if (!active.busy) {
          const generation = active.generation;
          try {
            const next = await enrollmentStatus(controller.signal);
            if (!controller.signal.aborted && generation === active.generation) { setView(next); setError(''); }
          } catch {
            if (!controller.signal.aborted && generation === active.generation) { setView(null); setError('登记候选当前不可用。'); }
          }
        }
        if (!controller.signal.aborted) timer = setTimeout(refresh, 500);
      }
      void refresh();
      return () => { controller.abort(); clearTimeout(timer); session.current = null; };
    }, []);

    async function command(operation) {
      const active = session.current;
      if (!active || active.busy || !view) return;
      const {signal} = active.controller;
      active.busy = true;
      active.generation++;
      setBusy(true);
      setError('');
      try {
        const next = await enrollmentCommand({operation, instanceId: view.instanceId, revision: view.revision}, signal);
        if (!signal.aborted) setView(next);
      } catch {
        if (!signal.aborted) { setView(null); setError('请求未确认，正在重新读取登记状态。'); }
      } finally { active.busy = false; if (!signal.aborted) setBusy(false); }
    }

    const offer = !busy && view?.issue !== 'transport_unavailable';
    const button = (label, operation) => h('button', {type: 'button', disabled: !offer,
      onClick: () => command(operation)}, label);
    const direct = view?.usbEnrollment === true;
    const title = direct ? 'USB 一键绑定候选' : 'BOOT 首次登记候选';
    return h('section', {'aria-label': title},
      h('h3', null, title),
      direct && view.phase === 'unregistered' ? h('p', null, '将绑定已确认身份的 USB 直连设备。') : null,
      view ? h('p', {role: 'status'}, labels[view.phase]) : null,
      view?.phase === 'bound' ? h('p', {role: 'status'}, view.deviceChecked ?
        '本次已从设备核对持久绑定。' : '本次尚未从设备核对。') : null,
      view?.issue && issues[view.issue] ? h('p', {role: 'alert'}, issues[view.issue]) : null,
      error ? h('p', {role: 'alert'}, error) : null,
      view?.busy ? button('停止等待', 'cancel') :
        view?.phase === 'unregistered' ? (direct ? button('绑定设备', 'enroll-usb') : button('登记新设备', 'enroll')) :
        view?.phase === 'recovery_required' ? button('核对绑定', 'recover') :
        view?.phase === 'bound' ? button('验证绑定', 'verify') : null);
  };
}
