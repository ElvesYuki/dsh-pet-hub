#include <fcntl.h>
#include <sys/file.h>
#include <sys/ioctl.h>
#include <termios.h>
#include <unistd.h>

int main(void) {
  const int tty = 3; /* Inherited from the owner, which keeps this description open. */
  struct termios mode;
  if (tcgetattr(tty, &mode) || flock(tty, LOCK_EX | LOCK_NB) || ioctl(tty, TIOCEXCL)) return 1;
  cfmakeraw(&mode);
  mode.c_cflag |= CLOCAL | CREAD;
  mode.c_cflag &= ~HUPCL;
#ifdef CRTSCTS
  mode.c_cflag &= ~CRTSCTS;
#endif
#ifdef CCTS_OFLOW
  mode.c_cflag &= ~CCTS_OFLOW;
#endif
#ifdef CRTS_IFLOW
  mode.c_cflag &= ~CRTS_IFLOW;
#endif
  mode.c_cc[VMIN] = 1;
  mode.c_cc[VTIME] = 0;
  if (tcsetattr(tty, TCSANOW, &mode)) return 1;
  const int flags = fcntl(tty, F_GETFL);
  return flags < 0 || fcntl(tty, F_SETFL, flags | O_NONBLOCK) != 0;
}
