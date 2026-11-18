// Original MIT host oracle; optional endpoint header remains outside this repo.
#include <cstdint>
#include <iostream>
#include <vector>
#include <string>
#ifdef ENDPOINT_HEADER
#include ENDPOINT_HEADER
#endif
int main(int argc,char**argv){
#ifdef ENDPOINT_HEADER
using namespace pet400_tcp_draft;Digest map;map.fill(0x22);std::array<Asset,4> assets{};unsigned ids[]={0,1,4,11};for(int i=0;i<4;i++){assets[i].action=ids[i];assets[i].sha.fill(ids[i]+1);}Control c(42,map,assets);auto g=c.connect(0);uint8_t op[56]{};put(op,42,8);memcpy(op+8,map.data(),32);memset(op+40,0x44,16);Record open{Type::Open,17,1,op,56};if(c.receive(open,g,0).code!=Code::Opened)return 21;uint8_t base[40]{};put(base,11,2);put(base+4,5000,4);memcpy(base+8,assets[3].sha.data(),32);Record command{Type::Base,17,2,base,40};auto a=c.receive(command,g,0);if(a.code!=Code::Accepted||!c.receive(command,g,1).replay)return 22;auto touch=c.desired(1);c.touch(2);auto local=c.desired(2);if(c.touch_done(touch.token,2)||!c.touch_done(local.token,3))return 23;auto current=c.desired(3);if(c.prepare(touch.token,55,assets[3].sha,3)||!c.prepare(current.token,55,assets[3].sha,3)||c.presented(current.token,54,0,3)||!c.presented(current.token,55,0,3))return 24;auto next=c.connect(4);if(c.disconnect(g,0)||!c.connected()||next==g)return 25;if(c.receive(open,next,4).code!=Code::Opened)return 26;Record ping{Type::Ping,17,2,nullptr,0};if(c.receive(ping,next,4).code!=Code::Pong||!c.receive(ping,next,5000).replay)return 27;c.desired(10004);if(c.connected())return 28;
#endif
for(int k=1;k<argc;k++){std::string s=argv[k];std::vector<uint8_t>b;for(size_t i=0;i<s.size();i+=2)b.push_back(std::stoul(s.substr(i,2),nullptr,16));if(b.size()<32)return 1;uint32_t crc=~0u;for(size_t i=0;i<b.size();i++){if(i>=28&&i<32)continue;crc^=b[i];for(int j=0;j<8;j++)crc=(crc>>1)^(0xedb88320u&uint32_t(-int(crc&1)));}crc=~crc;uint32_t expected=0;for(int i=0;i<4;i++)expected|=uint32_t(b[28+i])<<(8*i);if(expected!=crc)return 2;
#ifdef ENDPOINT_HEADER
pet400_tcp_draft::Parser parser;pet400_tcp_draft::Packet out;bool seen=false;for(auto x:b)if(!parser.feed(&x,1,[&](const pet400_tcp_draft::Record&r){seen=true;return pet400_tcp_draft::encode(r,out);} ))return 3;if(!seen||!parser.eof()||out.size!=b.size())return 4;for(size_t i=0;i<b.size();i++)if(out.bytes[i]!=b[i])return 5;
#endif
std::cout<<s<<'\n';}return 0;}
