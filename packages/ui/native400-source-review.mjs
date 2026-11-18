import {publicNative400SourceReviewView} from '../core/native400-source-review-view.mjs';
/** Source audit only; React text nodes, no buttons, callbacks, paths or transport. */
export function renderNative400SourceReview(h,input){
 const v=publicNative400SourceReviewView(input);if(!v)return null;
 const labels={empty:'尚无审阅记录',historical:'历史审阅，尚未本次复验',reviewing:'本次源文件复验中',current:'本次源文件复验通过',failed:'本次失败，旧记录仅作历史',cancelled:'本次已取消，旧记录仅作历史',closed:'审阅已关闭，记录仅作历史',uncertain:'保存结果未知，需关闭后独立重开核定'};
 return h('section',{'aria-label':'400来源文件审阅',style:{border:'1px solid #8885',padding:18,borderRadius:12,marginBottom:16}},
  h('h3',null,'400 来源文件审阅 · 离线候选'),h('p',{role:'status'},labels[v.phase]),h('p',null,`记录 revision ${v.revision}`),
  v.attempt?h('p',null,`正在检查：${v.attempt.source_name}`):null,
  v.error?h('p',{role:'alert'},`审阅未确认：${v.error}`):null,
  v.history?h('div',null,h('p',null,`历史来源：${v.history.source_name} · root ${v.history.root_sequence}`),h('p',null,`整文件 SHA256：${v.history.cache_sha256}`),h('p',null,`审阅映射 SHA256：${v.history.map_sha256}`),h('p',null,`历史引用动作：${v.history.objects.map(o=>o.action_id).join('、')}`)):null,
  h('p',{role:'note'},'仅核对来源文件整 SHA、目录元数据与每个引用 payload SHA；未执行全媒体验证，不是设备播放、保存或当前库存确认。本次通过仅指一次已完成检查，不持续监视源文件。'));
}
