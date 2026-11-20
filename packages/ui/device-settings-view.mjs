import {deviceSettingsStyle} from './device-settings-style.mjs';

const deviceSources = {tcp: 'TCP 实时状态', usb: 'USB 状态', offline: '设备未连接', unknown: '连接待确认'};
const powerFlow = {standby: '待机', charging: '充电中', discharging: '放电中', unknown: '未知'};
const chargePhase = {trickle: '滴流', precharge: '预充', cc: '恒流', cv: '恒压', full: '充电完成', idle: '未充电', unknown: '未知阶段'};
const batteryMessages = {busy: 'USB 或设备忙，等待下次采样。', rate_limited: '查询受限，等待下次采样。',
  no_reply: '电池查询无响应，固件可能不支持。', unavailable: '电池读取暂不可用。',
  disconnected: '已登记的 USB 设备未连接。', conflict: 'USB 目标关系已变化。',
  not_reported: '本次状态未上报电池数据。'};
const touchStates = {up: '未按下', down: '按下', unknown: '状态未知'};
const sensorMessages = {busy: '设备忙，等待下次采样。', rate_limited: '等待下次采样。',
  no_reply: '固件尚未返回传感器数据。', unavailable: '传感器数据暂不可用。',
  disconnected: 'USB 已断开。', conflict: 'USB 目标关系已变化。',
  not_reported: '本次状态未上报传感器数据。'};
const axes = (values, unit, precision) => values.map((value, i) =>
  `${'XYZ'[i]} ${(value / 1000).toFixed(precision)}`).join(' · ') + ' ' + unit;

function definition(h, label, value, {className, meter} = {}) {
  return h('div', null, h('dt', null, label), h('dd', {className}, value,
    meter != null ? h('progress', {className: 'pet-device-meter', value: meter, max: 100, 'aria-hidden': true}) : null));
}

function batteryMetric(h, sample) {
  const meter = sample?.present ? sample.percent : null;
  const value = !sample ? '待读取' : !sample.present ? '无电池' : meter == null ? '不可用' : meter + '%';
  return definition(h, '电量', value, {className: meter == null ? undefined : 'pet-device-battery-value', meter});
}

function powerDetails(h, card) {
  const sample = card.batteryReading;
  const status = batteryMessages[card.batteryStatus] ??
    (!sample ? (card.batteryStatus === 'ok' ? '电池读数已过时。' : '等待读取电池。') : null);
  return h('div', {className: 'pet-device-stack', 'aria-label': '电池'},
    sample ? h('dl', {className: 'pet-device-fields'},
      definition(h, '电压', sample.mv == null ? '不可用' : sample.mv + ' mV'),
      definition(h, '充电状态', sample.present ? powerFlow[sample.flow] + ' · ' + chargePhase[sample.phase] : '无电池'),
      definition(h, 'USB 供电', sample.usbPower ? '有输入' : '无输入')) : null,
    card.batteryStale && sample ? h('p', {className: 'pet-device-text-muted'}, '上次读取，当前读数待更新。') : null,
    status ? h('p', {className: 'pet-device-message'}, status) : null);
}

function sensorDetails(h, card) {
  const sensors = card.sensorReading;
  return h('details', {className: 'pet-device-detail', 'aria-label': '传感器'},
    h('summary', null, '传感器'),
    sensors ? h('dl', {className: 'pet-device-fields'},
      definition(h, '触摸', touchStates[sensors.touch.state]),
      definition(h, '最近触点', sensors.touch.last?.join(', ') ?? '尚无触点'),
      definition(h, '三轴加速度（含重力）', sensors.motion ? axes(sensors.motion.accelerationMg, 'g', 3) : '不可用'),
      definition(h, '三轴角速度', sensors.motion ? axes(sensors.motion.rotationMdps, '°/s', 2) : '不可用')) :
      h('p', {className: 'pet-device-message'}, sensorMessages[card.sensorStatus] ??
        (card.sensorStatus === 'ok' ? '传感器读数已过时。' : '等待读取传感器。')),
    card.sensorStale && sensors ? h('p', {className: 'pet-device-text-muted'}, '显示上次的传感器读数。') : null);
}

export function renderDesktopDevice(h, {card, sending, command, commandError, network, weather, motion}) {
  const blocked = sending || card.busy;
  const enrollFirst = card.enrollment && card.enrollment[1] !== 'verify';
  const button = (label, operation, disabled, primary = false) => h('button', {type: 'button', disabled,
    className: primary ? 'pet-device-btn pet-device-btn-primary' : 'pet-device-btn', onClick: () => command(operation)}, label);
  const bindButton = card.enrollment ? button(...card.enrollment, blocked, Boolean(enrollFirst)) : null;
  const queryButton = button(card.source === 'tcp' ? '查询 USB' : '查询设备', 'query', blocked || !card.canQuery, !enrollFirst);
  const battery = card.batteryAvailable && !card.batteryIndependent;
  const independent = card.queryResult || card.batteryIndependent;
  const queryDescription = card.queryStatus && h('p', {
    className: card.queryStatus === '已读取设备信息' ? 'pet-device-sr' : 'pet-device-message',
  }, card.queryStatus);
  const conflict = card.conflict ? h('p', {className: 'pet-device-alert'}, '绑定与查询的 USB 设备不同。查询结果暂不显示。') : null;
  const issue = card.issue ? h('p', {className: 'pet-device-alert'}, card.issue) : null;

  return h('section', {'aria-label': '桌面宠物设备', className: 'pet-device-page'},
    h('style', null, deviceSettingsStyle),
    h('article', {className: 'pet-device-panel pet-device-overview'},
      h('header', {className: 'pet-device-head'},
        h('div', {className: 'pet-device-identity'},
          h('span', {className: 'pet-device-mark', 'aria-hidden': true}, h('span', {className: 'pet-device-screen'})),
          h('div', null, h('h3', null, '1.75C-EN'), h('p', {className: 'pet-device-text-muted'}, '圆屏宠物'))),
        h('span', {className: 'pet-device-source', 'data-source': card.source}, deviceSources[card.source])),
      h('div', {className: 'pet-device-binding', role: 'status'},
        h('strong', null, card.label),
        card.evidence ? h('span', {className: 'pet-device-text-muted'}, card.evidence) : null),
      battery || !card.queryResult ? h('dl', {className: 'pet-device-metrics'},
        battery ? batteryMetric(h, card.batteryReading) : null,
        card.queryResult ? null : definition(h, '固件', card.device?.version ?? '尚未查询'),
        card.queryResult ? null : definition(h, '启动槽', card.device?.slot ?? '尚未查询')) : null,
      battery ? powerDetails(h, card) : null,
      queryDescription || conflict || issue ? h('div', {className: 'pet-device-feedback', role: 'status'},
        queryDescription, conflict, issue) : null,
      commandError ? h('p', {className: 'pet-device-alert', role: 'alert'}, commandError) : null,
      h('div', {className: 'pet-device-actions'},
        ...(enrollFirst ? [bindButton, queryButton] : [queryButton, bindButton]),
        card.canCancel ? button('停止等待', 'cancel', sending) : null),
      independent ? h('section', {'aria-label': 'USB 查询结果', className: 'pet-device-unverified'},
        h('h4', {className: 'pet-device-section-title'}, 'USB 查询结果'),
        h('p', {className: 'pet-device-text-muted'}, '与绑定目标的关系待核对。'),
        h('dl', {className: 'pet-device-metrics'},
          card.batteryIndependent ? batteryMetric(h, card.batteryReading) : null,
          card.queryResult ? definition(h, '固件', card.queryResult.version) : null,
          card.queryResult ? definition(h, '启动槽', card.queryResult.slot) : null),
        card.batteryIndependent ? powerDetails(h, card) : null,
        card.batteryIndependent ? sensorDetails(h, card) : null) : null),
    network || weather ? h('div', {className: 'pet-device-settings'}, network, weather) : null,
    motion,
    battery ? sensorDetails(h, card) : null);
}
