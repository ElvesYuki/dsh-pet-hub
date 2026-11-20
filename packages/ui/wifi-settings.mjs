const outcomes = {
  saved: '已保存到设备。请读取状态确认是否连上 Wi-Fi。',
  cleared: '已清除设备上的 Wi-Fi 配置。',
  unknown: '未收到写入确认，结果未知。请先读取状态，再决定是否重新提交。',
  busy: 'USB 或设备忙，请稍后重试。',
  invalid: '配置格式无效，请检查后重新填写密码。',
  storage_failed: '设备未能保存配置。',
  device_conflict: '当前 USB 设备与绑定目标不匹配。',
  no_reply: '设备未响应配网查询。请检查 USB 连接和固件版本。',
  unavailable: '无法完成配网查询。请确认绑定和 USB 连接。',
  state_changed: '设备状态有变化，请重新读取 Wi-Fi 状态。',
  backend_missing: '当前绑定插件版本未提供 USB Wi-Fi 配置。',
  unauthorized: '当前页面无权操作配网，请重新打开设置页。',
};
const links = {off: '未开启', connecting: '正在连接', online: '已联网', unavailable: '暂不可用'};

/** Read the uncontrolled form only for the current click. The password leaves the field immediately. */
export function readDesktopNetworkForm(form) {
  const element = name => form.elements.namedItem(name);
  const field = name => element(name).value;
  const passwordField = element('password');
  const password = new TextEncoder().encode(passwordField.value);
  passwordField.value = '';
  const weatherHost = field('weatherHost').trim();
  const latitude = field('latitude'), longitude = field('longitude');
  const position = (value, limit) => /^-?\d+(?:\.\d{1,4})?$/.test(value) && Math.abs(Number(value)) <= limit;
  if (!form.reportValidity() || (weatherHost && (!position(latitude, 90) || !position(longitude, 180))) ||
      (password.length && (password.length < 8 || password.length > 63 || password.some(byte => byte < 32 || byte > 126)))) {
    password.fill(0);
    return null;
  }
  return {password, config: {ssid: field('ssid'), timeHost: field('timeHost').trim(), weatherHost,
    utcMinutes: Number(field('utcMinutes')), latitudeE4: weatherHost ? Math.round(Number(latitude) * 10000) : 0,
    longitudeE4: weatherHost ? Math.round(Number(longitude) * 10000) : 0}};
}

export function wifiSettingsFields(h, {capable, blocked, network, command}) {
  const {result, info, checked} = network ?? {};
  const status = result?.status;
  const supported = capable && !['unsupported', 'backend_missing'].includes(status);
  const writable = supported && checked && !blocked;
  const input = (label, name, props = {}) => h('label', {className: 'pet-device-input-label'}, label,
    h('input', {name, className: 'pet-device-input', ...props}));
  const button = (label, operation, disabled, tone) => h('button', {type: 'button', disabled,
    className: tone ? 'pet-device-btn pet-device-btn-' + tone : 'pet-device-btn',
    onClick: event => command(operation, event.currentTarget.form)}, label);
  return h('section', {'aria-label': '设备 Wi-Fi', className: 'pet-device-panel'},
    h('h4', {className: 'pet-device-section-title'}, '设备 Wi-Fi'),
    h('div', {role: 'status', className: 'pet-device-message'},
      !capable ? outcomes.backend_missing : status === 'unsupported' ?
        `固件 ${result.version} 未响应 DESKNET2。请使用支持 USB 配网的固件。` :
        outcomes[status] ?? (info ? null : '先读取设备 Wi-Fi 状态，再填写配置。'),
      info ? h('div', null, `${info.configured ? '已配置' : '未配置'} · ${links[info.link] ?? '连接状态未知'}`) : null),
    capable ? h('div', {className: 'pet-device-actions'}, button('读取 Wi-Fi 状态', 'info', blocked)) : null,
    supported ? h('form', {onSubmit: event => event.preventDefault(), autoComplete: 'off', hidden: !checked,
      className: 'pet-device-separator'},
      h('fieldset', {disabled: !writable, className: 'pet-device-fieldset pet-device-stack'},
        h('legend', null, '通过 USB 配置'),
        input('网络名称（SSID）', 'ssid', {required: true, maxLength: 32}),
        input('密码（开放网络可留空）', 'password', {type: 'password', maxLength: 63, autoComplete: 'off'}),
        h('details', {className: 'pet-device-detail'}, h('summary', null, '时间与天气（高级）'),
          h('div', {className: 'pet-device-stack'},
          input('NTP 主机名', 'timeHost', {required: true, defaultValue: 'pool.ntp.org', maxLength: 63}),
          input('UTC 偏移（分钟）', 'utcMinutes', {type: 'number', required: true, step: 1, min: -720, max: 840,
            defaultValue: -new Date().getTimezoneOffset()}),
          input('天气主机名（可选）', 'weatherHost', {maxLength: 63}),
          input('纬度（设置天气时填写）', 'latitude', {inputMode: 'decimal'}),
          input('经度（设置天气时填写）', 'longitude', {inputMode: 'decimal'}))),
        h('div', {className: 'pet-device-actions'},
          button('保存 Wi-Fi 配置', 'set', !writable, 'primary'),
          button('清除设备 Wi-Fi', 'clear', !writable || !info?.configured, 'danger')))) : null);
}
