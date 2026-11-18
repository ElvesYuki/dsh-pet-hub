// Original MIT recipe byte writer; no firmware code or cryptographic claims.
// Arguments: N_boot, raw manifest SHA, raw index SHA, then four id/bytes/frames/F.
// Node tests hash these independently reconstructed bytes; no new wire format.
#include <algorithm>
#include <array>
#include <cstdint>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>
static std::string digest(const std::string&s){
 if(s.size()!=64||s.find_first_not_of("0123456789abcdef")!=std::string::npos)throw std::runtime_error("digest");return s;
}
static uint64_t number(const std::string&s,uint64_t limit){
 if(s.empty()||(s.size()>1&&s[0]=='0')||s.find_first_not_of("0123456789")!=std::string::npos)throw std::runtime_error("number");
 uint64_t n=0;for(char c:s){if(n>(limit-uint64_t(c-'0'))/10)throw std::runtime_error("range");n=n*10+uint64_t(c-'0');}if(n>limit)throw std::runtime_error("range");return n;
}
static void append(std::string&out,uint64_t n,unsigned bytes){static const char hex[]="0123456789abcdef";for(unsigned i=0;i<bytes;i++){out+=hex[(n>>4)&15];out+=hex[n&15];n>>=8;}}
struct Asset{uint64_t action,bytes,frames;std::string sha;};
int main(int argc,char**argv){try{
 if(argc!=20)throw std::runtime_error("args");
 std::string out;for(unsigned char c:std::string("pet400-tcp-map-draft/1"))append(out,c,1);append(out,0,1);
 for(int i=1;i<=3;i++)out+=digest(argv[i]);
 std::array<Asset,4> a{};for(int i=0;i<4;i++){const int p=4+i*4;a[i]={number(argv[p],65535),number(argv[p+1],UINT32_MAX),number(argv[p+2],65535),digest(argv[p+3])};}
 std::sort(a.begin(),a.end(),[](const Asset&a,const Asset&b){return a.action<b.action;});const unsigned ids[]={0,1,4,11};
 for(unsigned i=0;i<4;i++){if(a[i].action!=ids[i]||!a[i].bytes||a[i].frames!=241)throw std::runtime_error("inventory");append(out,a[i].action,2);append(out,a[i].bytes,4);append(out,a[i].frames,2);out+=a[i].sha;}
 std::cout<<out<<'\n';return 0;
 }catch(...){std::cerr<<"mapping_invalid\n";return 2;}}
