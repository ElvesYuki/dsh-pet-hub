const failure = /^status=(busy|rate_limited)$/;
const touchReply = /^status=ok touch=(up|down|unknown) x=(na|0|[1-9][0-9]{0,2}) y=(na|0|[1-9][0-9]{0,2}) imu=(ok|unavailable)(.*)$/;
const motionReply = /^ ax=(-?[0-9]{1,4}) ay=(-?[0-9]{1,4}) az=(-?[0-9]{1,4}) gx=(-?[0-9]{1,6}) gy=(-?[0-9]{1,6}) gz=(-?[0-9]{1,6})$/;

export function sensorReply(line, id) {
  const prefix = 'id=' + id + ' ';
  if (!line.startsWith(prefix)) return;
  const payload = line.slice(prefix.length);
  const error = failure.exec(payload);
  if (error) return {status: error[1]};
  const match = touchReply.exec(payload);
  if (!match) return;
  const [, state, x, y, imu, rest] = match;
  if ((x === 'na') !== (y === 'na') || Number(x) > 465 || Number(y) > 465) return;
  const touch = {state, last: x === 'na' ? null : [Number(x), Number(y)]};
  if (imu === 'unavailable') return rest === '' ? {status: 'ok', touch, motion: null} : undefined;
  const axes = motionReply.exec(rest)?.slice(1).map(Number);
  if (!axes || axes.some((value, index) => Math.abs(value) > (index < 3 ? 4000 : 256000))) return;
  return {status: 'ok', touch, motion: {accelerationMg: axes.slice(0, 3), rotationMdps: axes.slice(3)}};
}
