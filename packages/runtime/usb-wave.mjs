const steps = [
  /^DAILY REQUEST source=usb at_us=\d+$/,
  /^FIRST 4-400 local_us=\d+ boot_to_dma_us=\d+$/,
  /^DAILY END clip=4-400 eof=1$/,
  /^RESULT 4-400 frames=241(?: |$)/,
  /^FIRST 0-400 local_us=\d+ boot_to_dma_us=\d+$/,
];

/** Consume filtered firmware lines belonging to one exclusive WAVE request. */
export function observeWave() {
  let step = 0;
  return line => {
    if (step > 0 && step < steps.length &&
        (/^DAILY (?:CANCEL clip=4-400 |END clip=4-400 eof=0$|REQUEST source=touch )/.test(line) ||
         (step === 3 && /^RESULT 4-400 frames=/.test(line) && !steps[3].test(line))))
      throw new Error('wave_incomplete');
    if (!steps[step]?.test(line)) return null;
    step++;
    if (step === 2) return {phase: 'playing'};
    if (step === 4) return {phase: 'returning', frames: 241};
    if (step === 5) return {phase: 'complete', returnedIdle: true};
    return null;
  };
}
