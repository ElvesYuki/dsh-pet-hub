#pragma once
#include "control_owner.h"
#include <cerrno>
#include <fcntl.h>
#ifdef ESP_PLATFORM
#include "lwip/sockets.h"
#include "lwip/tcp.h"
#else
#include <sys/socket.h>
#include <sys/select.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <unistd.h>
#endif

namespace pet400_transport {
// Shared POSIX/lwIP implementation. No DNS, TLS, listener, Wi-Fi or config IO.
struct SocketOps {
  int last_error=0;
  int reject(int fd) {
    const int error=errno;
    if(::close(fd)<0) { last_error=errno;return -2; }
    last_error=error;return -1;
  }
  int dial(const Endpoint &endpoint) {
    const int fd=::socket(AF_INET,SOCK_STREAM,IPPROTO_TCP);if(fd<0) { last_error=errno;return -1; }
    const int flags=::fcntl(fd,F_GETFL,0),one=1;
    if(flags<0 || ::fcntl(fd,F_SETFL,flags|O_NONBLOCK)<0 ||
       ::setsockopt(fd,IPPROTO_TCP,TCP_NODELAY,&one,sizeof(one))<0)return reject(fd);
#ifdef SO_NOSIGPIPE
    if(::setsockopt(fd,SOL_SOCKET,SO_NOSIGPIPE,&one,sizeof(one))<0)return reject(fd);
#endif
    sockaddr_in address{};address.sin_family=AF_INET;address.sin_port=htons(endpoint.port);
    const auto &ip=endpoint.ip;address.sin_addr.s_addr=htonl(uint32_t(ip[0])<<24|uint32_t(ip[1])<<16|uint32_t(ip[2])<<8|ip[3]);
    if(::connect(fd,reinterpret_cast<sockaddr*>(&address),sizeof(address))<0 && errno!=EINPROGRESS && errno!=EWOULDBLOCK)return reject(fd);
    last_error=0;
    return fd;
  }
  int connected(int fd) {
    if(fd<0 || fd>=FD_SETSIZE) { last_error=EINVAL;return -1; }
    fd_set write,error;FD_ZERO(&write);FD_ZERO(&error);FD_SET(fd,&write);FD_SET(fd,&error);timeval wait{};
    const int n=::select(fd+1,nullptr,&write,&error,&wait);
    if(n<0) { if(errno==EINTR)return 0;last_error=errno;return -1; }
    if(!n)return 0;
    int code=0;socklen_t size=sizeof(code);
    if(::getsockopt(fd,SOL_SOCKET,SO_ERROR,&code,&size)<0) { last_error=errno;return -1; }
    last_error=code;return code?-1:1;
  }
  int read(int fd,uint8_t *data,size_t size) {
    const auto n=::recv(fd,data,size,0);
    if(n<0 && (errno==EAGAIN || errno==EWOULDBLOCK || errno==EINTR))return 0;
    if(n<=0) { last_error=n<0?errno:0;return -1; } // EOF is terminal, not would-block.
    return int(n);
  }
  int write(int fd,const uint8_t *data,size_t size) {
#ifdef MSG_NOSIGNAL
    constexpr int flags=MSG_NOSIGNAL;
#else
    constexpr int flags=0;
#endif
    const auto n=::send(fd,data,size,flags);
    if(n<0 && (errno==EAGAIN || errno==EWOULDBLOCK || errno==EINTR))return 0;
    if(n<0)last_error=errno;
    return n<0?-1:int(n);
  }
  bool close(int fd) { if(::close(fd)==0)return true;last_error=errno;return false; } // Do not retry an ambiguous EINTR close.
};
} // namespace pet400_transport
