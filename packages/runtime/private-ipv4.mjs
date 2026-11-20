import {isIPv4} from 'node:net';

/** Check direct RFC 1918 IPv4 source or destination addresses. */
export function isPrivateIPv4(address) {
  if (!isIPv4(address)) return false;
  const [first, second] = address.split('.').map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}
