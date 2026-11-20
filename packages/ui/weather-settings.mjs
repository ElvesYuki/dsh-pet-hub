const weatherDeviceMessages = {
  saved: '天气地点已保存到设备。',
  cleared: '已清除天气地点。',
  unknown: '设备未确认写入。请先读取地点，再决定是否重新提交。',
  busy: 'USB 或设备忙，请稍后再试。',
  invalid: '设备拒绝了地点配置。',
  storage_failed: '设备未能保存天气地点。',
  device_conflict: '当前 USB 设备与绑定目标不匹配。',
  no_reply: '设备未响应天气地点查询。',
  unavailable: '无法读取天气地点，请确认设备绑定和 USB 连接。',
  state_changed: '设备状态有变化，请重新读取地点。',
  backend_missing: '当前绑定插件版本未提供独立天气地点。',
  unauthorized: '当前页面无权操作天气地点，请重新打开设置页。',
};
const weatherSearchMessages = {loading: '正在查找城市…', empty: '没有找到匹配城市。可加上省份或国家后再搜索。',
  invalid: '请输入 2–80 个字符。', failed: '暂时无法搜索城市，请稍后再试。'};
const placeCoordinates = place => `${(place.latitudeE4 / 10000).toFixed(4)}°, ${(place.longitudeE4 / 10000).toFixed(4)}°`;

export function weatherSettingsFields(h, {capable, bound, blocked, device, lookup, search, choose, command}) {
  const status = device?.result?.status;
  const supported = capable && !['unsupported', 'backend_missing'].includes(status);
  const readable = capable && bound && !blocked;
  const writable = readable && supported && !device?.needsReadback;
  const button = (label, onClick, disabled, tone) => h('button', {type: 'button', onClick, disabled,
    className: tone ? 'pet-device-btn pet-device-btn-' + tone : 'pet-device-btn'}, label);
  return h('section', {'aria-label': '天气地点', className: 'pet-device-panel'},
    h('h4', {className: 'pet-device-section-title'}, '天气地点'),
    capable ? h('form', {onSubmit: event => {
      event.preventDefault();
      return search(event.currentTarget.elements.namedItem('city').value);
    }, 'aria-label': '搜索天气城市', className: 'pet-device-stack'},
    h('label', {className: 'pet-device-input-label'}, '城市', h('input', {name: 'city', maxLength: 160, autoComplete: 'off', required: true,
      className: 'pet-device-input', placeholder: '城市名，可加省份或国家'})),
    h('div', {className: 'pet-device-actions'}, h('button', {type: 'submit', className: 'pet-device-btn'}, '搜索城市')),
    h('small', null, '搜索词会发送给 Open-Meteo。地点数据来自 GeoNames。')) : null,
    h('div', {role: 'status', className: 'pet-device-message pet-device-optional'}, weatherSearchMessages[lookup?.state] ?? null),
    capable && lookup?.places?.length ? h('fieldset', {className: 'pet-device-fieldset pet-device-stack'},
      h('legend', null, '选择地点'), ...lookup.places.map(place => h('label', {key: place.id, className: 'pet-device-place'},
        h('input', {type: 'radio', name: 'pet-device-weather-place', checked: lookup.selected === place, onChange: () => choose(place)}),
        h('span', null, h('strong', null, place.name),
          h('small', null, [...place.area, placeCoordinates(place)].join(' · ')))))) : null,
    h('div', {role: 'status', className: 'pet-device-message pet-device-optional'}, !capable ? weatherDeviceMessages.backend_missing :
      status === 'unsupported' ? `固件 ${device.result.version} 未响应独立天气地点查询。` :
        weatherDeviceMessages[status] ?? (!bound ? '绑定设备并连接 USB 后可保存地点。' : null),
    device?.needsReadback && !['unknown', 'state_changed'].includes(status) ? h('div', null, '读取地点成功后可再次提交。') : null,
    device?.info ? h('div', null, device.info.configured ? `设备地点 · ${placeCoordinates(device.info)}` : '设备未配置天气地点') : null),
    capable ? h('div', {className: 'pet-device-actions pet-device-separator'},
      button('读取设备地点', () => command('info'), !readable),
      button('保存天气地点', () => command('set'), !writable || !lookup?.selected, 'primary'),
      button('清除天气地点', () => command('clear'), !writable || !device?.info?.configured, 'danger')) : null);
}
