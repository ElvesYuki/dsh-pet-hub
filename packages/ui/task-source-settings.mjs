const taskSourceLabels = {off: '关闭', dsh: 'DSH（本机）', codex: 'Codex（本机）', pet: 'DSH pet（兼容）'};
const taskStateLabels = {thinking: '思考', working: '工作中', result: '整理', waiting: '等待输入', success: '已完成', error: '出错'};

export function makeTaskSourceSettings(React, transport) {
  const {createElement: h, useEffect, useRef, useState} = React;

  function SourceForm({view, busy, save}) {
    const [source, setSource] = useState(view.source), [sessionId, setSession] = useState(view.sessionId);
    const available = view.available;
    const options = ['off', 'dsh', 'codex', ...(available.includes('pet') || view.source === 'pet' ? ['pet'] : [])];
    const off = source === 'off';
    const nextSession = off ? '' : sessionId.trim();
    return h('form', {className: 'pet-device-stack', onSubmit: event => {
      event.preventDefault();
      void save({instance: view.instance, revision: view.revision, source, sessionId: nextSession});
    }},
    h('label', {className: 'pet-device-input-label'}, '状态来源',
      h('select', {value: source, disabled: busy, className: 'pet-device-input', onChange: event => {
        const next = event.target.value;
        setSource(next);
        setSession(next === view.source ? view.sessionId : '');
      }}, ...options.map(value => h('option', {key: value, value, disabled: !available.includes(value)},
        taskSourceLabels[value] + (available.includes(value) ? '' : ' · 未配置'))))),
    off ? null : h('label', {className: 'pet-device-input-label'}, source === 'codex' ? 'Codex 会话 ID' : 'DSH 会话 ID',
      h('input', {className: 'pet-device-input', value: sessionId, disabled: busy, required: true, maxLength: 256,
        autoComplete: 'off', onChange: event => setSession(event.target.value)})),
    h('div', {className: 'pet-device-actions'}, h('button', {type: 'submit', className: 'pet-device-btn pet-device-btn-primary',
      disabled: busy || !available.includes(source) || (!off && !nextSession) ||
        (source === view.source && nextSession === view.sessionId)}, busy ? '保存中' : '保存来源')));
  }

  return function TaskSourceSettings() {
    const [view, setView] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(null);
    const active = useRef(null);
    useEffect(() => {
      const controller = new AbortController(), {signal} = controller;
      const session = {controller, busy: false, revision: 0};
      active.current = session;
      let timer;
      async function refresh() {
        if (!session.busy) {
          const revision = session.revision;
          try {
            const result = await transport.status(signal);
            if (!signal.aborted && revision === session.revision) {
              setView(result);
              if (result === null) return;
            }
          } catch { /* Preserve the last accessible preferences for retry. */ }
        }
        if (!signal.aborted) timer = setTimeout(refresh, 1500);
      }
      void refresh();
      return () => { controller.abort(); clearTimeout(timer); active.current = null; };
    }, []);
    if (!view || !Array.isArray(view.available)) return null;

    async function save(input) {
      const session = active.current;
      if (!session || session.busy) return;
      const {signal} = session.controller;
      session.busy = true;
      session.revision++;
      setBusy(true);
      setError(null);
      try {
        const next = await transport.select(input, signal);
        if (!signal.aborted) setView(next);
      } catch (failure) {
        if (!signal.aborted) setError(failure.status === 409 ? '来源设置已变化，请核对后重试。' : '来源保存未确认，请重试。');
      } finally {
        session.busy = false;
        if (!signal.aborted) setBusy(false);
      }
    }
    const status = {off: '联动已关闭', pending: '正在读取本机状态', unavailable: '本机状态暂不可用',
      ready: taskStateLabels[view.state] ?? '当前空闲'}[view.status];
    return h('section', {'aria-label': '动画联动', className: 'pet-device-panel'},
      h('h4', {className: 'pet-device-section-title'}, '动画联动'),
      h(SourceForm, {key: view.instance + '/' + view.revision, view, busy, save}),
      h('p', {className: 'pet-device-message', role: 'status'}, status),
      error ? h('p', {className: 'pet-device-alert', role: 'alert'}, error) : null);
  };
}
