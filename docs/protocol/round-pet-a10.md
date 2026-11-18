# A10 不变根编码与摘要复用

2026-10-30。[实现前Spec](../context/plans/round-pet-a10-spec.md)/[Diff](../context/plans/round-pet-a10-diff.md)、[报告](../reports/2026-10-30-round-pet-a10.md)。局部减少重复构造，不增加跨请求缓存或生产入口。

## 存储边界

openBindingStore内部可选rootStrategy='full'|'reduced'，默认reduced。仅rootState=true采用减量；默认v1行为/格式保持，显式v2仍是hub-binding-roots/1/content schemaVersion=2，无自动升级/迁移/清floor。策略不持久保存、不进入CLI/IPC/插件或选主配置；full/reduced的权威结果、权限与文件完全兼容，差异仅为重复工作成本。

- 每次新scope/请求/4KiB块前仍完整读盘，检查私有路径/类型/大小、JSON、封套protocol、重算完整content SHA与schema。loader只在私有调用栈中携带同次验证的data/digest；read、record、rootCheckpoint仍返回clone，不暴露digest票据。作用域不跨await，外部改动须下一scope发现。
- reduced的remember复用该digest比较实例内最高revision/同revision内容；成功写入后复用同次完整编码的digest。不信任仅从文件取出的sha字段，不跳过重算，不按mtime/TTL认定未变，不保留跨请求字节或摘要缓存。
- 不变checkpoint仍先通过输入验证、单调root/floor_commit、绑定准入和预读。reduced省略候选全文件编码，但仍wx取得锁，锁内新完整读取/验证、remember、revision CAS及全部候选内容一致检查；只有全部成功才返回clone且不增revision/不写盘。full保留原先noop也编码的路径。
- 变更写仍完整schema/大小/摘要编码→锁/CAS→临时文件写/fsync→rename→目录fsync→remember→发布前新scope/session/截止复验。不变根的编码跳过不改变实际写入顺序。写前保旧档，rename后错误unknown冻结；不可用延长TTL或自动重试恢复。

有效旧文件的整盘回放仍不能被新进程自行识别；实例revision/hash不是持久外部信任锚。同步FS不可由JS timer硬抢占，fsync不证明物理掉电耐久。

## 固定计数与同负载

沿用A9各scope/嵌套时间口径，新增四个可选数值计数：root_full_file_hashes（本次读盘实际重算）、root_extra_digest_calls（remember额外重算）、root_verified_digest_reuses（同次验证/编码结果复用）、root_noop_encode_skips（锁内成功noop省编码）。v1不计这些root事件。未出现的计数按0；无metrics仍同语义。root_encode只记录实际编码，不能以scope次数减少误报完整读取减少。

A9测量helper默认显式full保持参考；A10在同一独立运行内先full再reduced，各v1/v2×1/64登记、每档3轮，同字节/trace/CRC。只有D一个TLS peer，64为登记数。相同metadata load/逻辑字节、动态日期/撤销检查、锁/CAS/实际写/同步是验收条件；毫秒不要求一定改善，不作为上界。最大字段容量/条件预算另对等，不扩大131072B/64条或期限。

证据validator位于scripts/lib，不进runtime：封闭scope/full/reduced结构，先校验各A9固定数值字段/桶，再核对工作量及保护成本，验证reduced extra=0、reuse=remember、文件hash=完整load、编码次数差=noop。只全部24专项通过才导出去敏观察，错误/取消不导出部分证据。

```sh
npm run check
npm test
node scripts/verify-round-pet-a10.mjs --output .cache/round-pet-a10/results.json
```

测试用原创恒定索引PET4和临时PKI/私有权威目录、虚拟时钟及literal loopback TLS，不接真实素材/设备。取消与正常路径关闭自有socket/Agent/实际HTTP/read/store并删除临时环境；回退在代码中显式full或撤回局部减量即可，无格式/配置迁移，不调整现有服务。独立CLI会重建未安装dist候选，应避免与其他构建并发。

## 下一门槛

局部重复成本切片已闭合；下一共同G0 C01–C12、真实46包原ID/N/F/M/P/来源许可批准和Node-C++向量，再依固件G1/G2资源证据评审。冷盘/OS停顿/网络重传/漂移、可信时间/持久凭据/秘密、可信恢复/外部锚、Flash维护让出与取消硬上界仍未知；不启用生产listener、设备通道或自动迁移。
