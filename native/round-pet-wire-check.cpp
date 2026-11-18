// Original MIT offline host oracle. No ESP APIs, firmware code, network or third-party JSON library.
#include <algorithm>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <iterator>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>
using std::string;
static void need(bool b){if(!b)throw std::runtime_error("wire_rejected");}
struct J{
 enum T{Null,Bool,Num,Str,Arr,Obj} t=Null;bool b=false;int64_t n=0;string s;std::vector<J>a;std::map<string,J>o;
 bool has(const string&k)const{return t==Obj&&o.count(k);}
 const J& at(const string&k)const{need(t==Obj&&o.count(k));return o.at(k);}
};
static void utf8(string&out,uint32_t c){need(c<=0x10ffff&&!(c>=0xd800&&c<=0xdfff));if(c<128)out+=char(c);else if(c<2048){out+=char(0xc0|(c>>6));out+=char(0x80|(c&63));}else if(c<65536){out+=char(0xe0|(c>>12));out+=char(0x80|((c>>6)&63));out+=char(0x80|(c&63));}else{out+=char(0xf0|(c>>18));out+=char(0x80|((c>>12)&63));out+=char(0x80|((c>>6)&63));out+=char(0x80|(c&63));}}
struct Parser{
 const string&s;size_t p=0,nodes=0;unsigned maxDepth;
 Parser(const string&in,unsigned depth):s(in),maxDepth(depth){}
 void ws(){while(p<s.size()&&(s[p]==' '||s[p]=='\t'||s[p]=='\r'||s[p]=='\n'))++p;}
 char take(){need(p<s.size());return s[p++];}
 uint32_t hex(){uint32_t n=0;for(int i=0;i<4;++i){char c=take();need((c>='0'&&c<='9')||(c>='a'&&c<='f')||(c>='A'&&c<='F'));n=n*16+(c<='9'?c-'0':(c<='F'?c-'A'+10:c-'a'+10));}return n;}
 string str(){need(take()=='"');string out;while(p<s.size()){unsigned c=static_cast<unsigned char>(take());if(c=='"')return out;need(c>=32);if(c=='\\'){char e=take();if(e=='"'||e=='\\'||e=='/')out+=e;else if(e=='b')out+='\b';else if(e=='f')out+='\f';else if(e=='n')out+='\n';else if(e=='r')out+='\r';else if(e=='t')out+='\t';else if(e=='u'){auto cp=hex();if(cp>=0xd800&&cp<=0xdbff){need(take()=='\\'&&take()=='u');auto lo=hex();need(lo>=0xdc00&&lo<=0xdfff);cp=0x10000+((cp-0xd800)<<10)+(lo-0xdc00);}utf8(out,cp);}else need(false);}else if(c<128)out+=char(c);else{unsigned count=0;uint32_t cp=0,low=0;if(c>=0xc2&&c<=0xdf){count=1;cp=c&31;low=128;}else if(c>=0xe0&&c<=0xef){count=2;cp=c&15;low=2048;}else if(c>=0xf0&&c<=0xf4){count=3;cp=c&7;low=65536;}else need(false);for(unsigned i=0;i<count;++i){unsigned b=static_cast<unsigned char>(take());need((b&0xc0)==0x80);cp=(cp<<6)|(b&63);}need(cp>=low);utf8(out,cp);}}need(false);return {};}
 J val(unsigned depth=0){need(depth<=maxDepth&&++nodes<=20000);ws();need(p<s.size());J v;char c=s[p];if(c=='"'){v.t=J::Str;v.s=str();return v;}if(c=='{'||c=='['){++p;v.t=c=='{'?J::Obj:J::Arr;char end=c=='{'?'}':']';ws();if(p<s.size()&&s[p]==end){++p;return v;}for(;;){ws();string key;if(v.t==J::Obj){key=str();need(!v.o.count(key));ws();need(take()==':');}J x=val(depth+1);if(v.t==J::Obj)v.o.emplace(key,x);else v.a.push_back(x);ws();char sep=take();if(sep==end)return v;need(sep==',');}}
 for(const auto& token:std::vector<string>{"null","true","false"})if(s.compare(p,token.size(),token)==0){p+=token.size();v.t=token=="null"?J::Null:J::Bool;v.b=token=="true";return v;}
 size_t begin=p;if(s[p]=='-')++p;need(p<s.size()&&s[p]>='0'&&s[p]<='9');if(s[p]=='0')++p;else while(p<s.size()&&s[p]>='0'&&s[p]<='9')++p;string token=s.substr(begin,p-begin);need(token!="-0");v.t=J::Num;v.n=std::stoll(token);need(v.n>=-9007199254740991LL&&v.n<=9007199254740991LL);return v;}
 J parse(){J v=val();ws();need(p==s.size());return v;}
};
static string quote(const string&s){string out="\"";const char*hex="0123456789abcdef";for(unsigned char c:s){if(c=='"'||c=='\\'){out+='\\';out+=char(c);}else if(c=='\b')out+="\\b";else if(c=='\f')out+="\\f";else if(c=='\n')out+="\\n";else if(c=='\r')out+="\\r";else if(c=='\t')out+="\\t";else if(c<32){out+="\\u00";out+=hex[c>>4];out+=hex[c&15];}else out+=char(c);}return out+'"';}
static string canonical(const J&v){switch(v.t){case J::Null:return "null";case J::Bool:return v.b?"true":"false";case J::Num:return std::to_string(v.n);case J::Str:return quote(v.s);case J::Arr:{string out="[";for(size_t i=0;i<v.a.size();++i){if(i)out+=',';out+=canonical(v.a[i]);}return out+"]";}case J::Obj:{string out="{";bool comma=false;for(auto&[k,x]:v.o){if(comma)out+=',';comma=true;out+=quote(k)+":"+canonical(x);}return out+"}";}}throw std::runtime_error("type");}
static bool equal(const J&a,const J&b){return canonical(a)==canonical(b);}
static bool idchar(unsigned char c){return (c>='A'&&c<='Z')||(c>='a'&&c<='z')||(c>='0'&&c<='9')||c=='_'||c=='-';}
static bool decimal(const string&s){if(s.empty()||s.size()>20||(s.size()>1&&s[0]=='0'))return false;for(char c:s)if(c<'0'||c>'9')return false;return s.size()<20||s<="18446744073709551615";}
static int cmp(const string&a,const string&b){if(a.size()!=b.size())return a.size()<b.size()?-1:1;return a==b?0:(a<b?-1:1);}
static bool matches(const J&v,const J&s,const J&defs,unsigned d=0){
 if(d>32)return false;if(s.t==J::Str)return defs.has(s.s)&&matches(v,defs.at(s.s),defs,d+1);
 if(s.has("const"))return equal(v,s.at("const"));if(s.has("enum")){for(auto&x:s.at("enum").a)if(equal(v,x))return true;return false;}
 if(s.has("oneOf")){int n=0;for(auto&x:s.at("oneOf").a)if(matches(v,x,defs,d+1))++n;return n==1;}
 string t=s.at("type").s;if(t=="null")return v.t==J::Null;if(t=="boolean")return v.t==J::Bool;
 if(t=="integer")return v.t==J::Num&&v.n>=s.at("min").n&&v.n<=s.at("max").n;
 if(t=="string"){if(v.t!=J::Str)return false;string f=s.at("format").s;if(f=="id")return !v.s.empty()&&v.s.size()<=80&&std::all_of(v.s.begin(),v.s.end(),idchar);if(f=="sha")return v.s.size()==64&&std::all_of(v.s.begin(),v.s.end(),[](char c){return(c>='0'&&c<='9')||(c>='a'&&c<='f');});return decimal(v.s)&&(f!="positive"||v.s!="0");}
 if(t=="array"){if(v.t!=J::Arr||v.a.size()<size_t(s.at("min").n)||v.a.size()>size_t(s.at("max").n))return false;for(auto&x:v.a)if(!matches(x,s.at("items"),defs,d+1))return false;return true;}
 if(t=="object"){if(v.t!=J::Obj||v.o.size()!=s.at("fields").o.size())return false;for(auto&[k,x]:s.at("fields").o)if(!v.has(k)||!matches(v.at(k),x,defs,d+1))return false;return true;}return false;
}
static bool stris(const J&o,const string&k,const string&v){return o.has(k)&&o.at(k).t==J::Str&&o.at(k).s==v;}
static void semanticWalk(const J&o,const J&ctx){
 if(o.t==J::Arr){for(auto&x:o.a)semanticWalk(x,ctx);return;}if(o.t!=J::Obj)return;
 if(o.has("control")&&o.at("control").has("control_epoch")){const J&c=o.at("control");need(equal(c.at("controller_id"),ctx.at("controller_id"))&&equal(c.at("service_instance_id"),ctx.at("service_instance_id")));}
 if(o.has("package_ref")){for(const auto&name:{"target","source_target"})if(o.has(name))need(equal(o.at(name).at("manifest_sha256"),o.at("package_ref").at("hub_manifest_sha256")));}
 if(stris(o,"type","lease.granted"))need(equal(o.at("context"),ctx));
 if(stris(o,"type","inventory.snapshot")&&o.at("known").b){int64_t previous=-1;bool idle=false,touch=false;for(auto&a:o.at("active").a){need(a.at("action_id").n>previous&&cmp(a.at("object_generation").s,o.at("root_seq").s)<=0);previous=a.at("action_id").n;idle|=previous==0;touch|=previous==4;}auto state=o.at("root_state").s;need(state=="EMPTY"?o.at("active").a.empty():state=="IDLE_READY"?o.at("active").a.size()==1&&idle:idle&&touch);}
 if(stris(o,"type","storage.report")&&o.at("commit").t!=J::Null)need(cmp(o.at("commit").at("object_generation").s,o.at("commit").at("root_seq").s)<=0);
 if(stris(o,"type","display.report")){need(stris(o,"kind","event")?o.at("query_id").t==J::Null:o.at("query_id").t!=J::Null);need(!stris(o,"display_state","playing")||stris(o.at("maintenance"),"phase","none"));if(!stris(o,"display_state","unknown")){if(stris(o,"origin","local"))need(o.at("asset_ref").at("action_id").n==0||o.at("asset_ref").at("action_id").n==4);else{const auto&t=o.at("source_command").at("target");need(equal(t.at("action_id"),o.at("asset_ref").at("action_id"))&&equal(t.at("asset_sha256"),o.at("asset_ref").at("asset_sha256")));}}}
 if(stris(o,"kind","storage.save")&&o.at("payload").at("victim_action_id").t!=J::Null){auto n=o.at("payload").at("victim_action_id").n;need(n!=0&&n!=4&&n!=o.at("payload").at("target").at("action_id").n);}
 for(auto&[k,x]:o.o){(void)k;semanticWalk(x,ctx);}
}
static void semantics(const J&v){const auto&p=v.at("payload");semanticWalk(p,v.at("context"));if(stris(v,"type","error"))need((v.at("request_id").t==J::Null)==(v.at("request_seq").t==J::Null));if(stris(v,"type","hello.begin"))need(equal(p.at("versions"),p.at("capabilities").at("extensions").at("round_pet").at("versions")));if(stris(v,"type","exchange.request")&&p.at("observation").t!=J::Null&&stris(p.at("observation").at("record"),"type","touch.event"))need(p.at("observation").at("dispatch_id").t==J::Null);if(stris(v,"type","exchange.response"))need(p.at("control").t==J::Null||p.at("read_permit").t==J::Null);if(stris(v,"type","manifest.page")){auto end=p.at("offset").n+int64_t(p.at("actions").a.size());need(end<=46);need(end==46?p.at("next_offset").t==J::Null:p.at("next_offset").t==J::Num&&p.at("next_offset").n==end);int64_t previous=-1;for(auto&a:p.at("actions").a){need(a.at("action_id").n>previous);previous=a.at("action_id").n;}}}
int main(int argc,char**argv){if(argc!=2)return 3;J contract;try{std::ifstream f(argv[1]);need(f.good());string raw((std::istreambuf_iterator<char>(f)),{});need(raw.size()<=262144);contract=Parser(raw,64).parse();need(stris(contract,"contract","round-pet-wire-table/1"));need(contract.has("defs")&&contract.at("defs").has("message"));}catch(...){return 3;}try{string raw;char c;while(std::cin.get(c)){raw+=c;need(raw.size()<=4096);}need(!raw.empty());J value=Parser(raw,16).parse();need(canonical(value)==raw);need(matches(value,contract.at("defs").at("message"),contract.at("defs")));semantics(value);std::cout<<canonical(value);return 0;}catch(...){std::cout<<"reject";return 2;}}
