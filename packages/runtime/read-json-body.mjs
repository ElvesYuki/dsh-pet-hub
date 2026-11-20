import {parseRoundPetJson} from '../core/round-pet-identity.mjs';

const bodyError = code => Object.assign(new Error(code), {code});

/** Parse bounded JSON from a Node request stream. Discard excess bytes while the stream drains. */
export function readJsonBody(request, {signal} = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0, finished = false;

    function finish(error, value) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      chunks.length = 0;
      if (error) reject(error);
      else resolve(value);
    }

    const abort = () => finish(bodyError('controls_cancelled'));
    const timer = setTimeout(() => finish(bodyError('controls_deadline')), 2500);
    signal?.addEventListener('abort', abort, {once: true});
    if (signal?.aborted || request.aborted) {
      abort();
      return;
    }

    request.on('data', chunk => {
      if (finished) return;
      size += chunk.length;
      if (size > 4096) finish(bodyError('controls_body_too_large'));
      else chunks.push(chunk);
    });
    request.on('error', error => finish(error));
    request.on('aborted', abort);
    request.on('end', () => {
      if (finished) return;
      try { finish(null, parseRoundPetJson(Buffer.concat(chunks))); }
      catch { finish(bodyError('controls_invalid_request')); }
    });
  });
}
