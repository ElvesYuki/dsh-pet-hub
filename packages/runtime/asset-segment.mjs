import {bounded,requireThat,digest} from '../core/protocol.mjs';
export const MAX_SEGMENT_BYTES=32768;
/** Parse one explicit inclusive byte range, against an already authorized immutable asset.
 * Rejects suffix/multiple ranges and stale If-Range; returns {start,end,length,etag}. No I/O. */
export function assetRange(headers,total,sha){bounded(total,1,2**31-1);digest(sha);const etag='"'+sha+'"';requireThat(headers['if-range']===etag,'asset_changed');const m=/^bytes=(0|[1-9][0-9]{0,9})-(0|[1-9][0-9]{0,9})$/.exec(headers.range??'');requireThat(m,'invalid_range');const start=Number(m[1]),end=Number(m[2]);requireThat(start<=end&&end<total&&end-start+1<=MAX_SEGMENT_BYTES,'invalid_range');return {start,end,length:end-start+1,etag};}
/** Validates a fully bounded segment after transport completion; no partial bytes are published.
 * Returns a private Buffer copy or throws segment_response. Full asset SHA remains caller's duty. */
export function validateSegmentResponse({status,headers,body,range,total,sha}){digest(sha);requireThat(status===206&&headers.etag==='"'+sha+'"'&&headers['content-range']===`bytes ${range.start}-${range.end}/${total}`&&headers['content-length']===String(range.length)&&!headers['transfer-encoding']&&!headers['content-encoding']&&!headers.location&&body instanceof Uint8Array&&body.length===range.length&&body.length<=MAX_SEGMENT_BYTES,'segment_response');return Buffer.from(body);}
