#if defined(__APPLE__)
#include <util.h>
#else
#include <pty.h>
#endif
#include <stdio.h>
#include <string.h>
#include <sys/select.h>
#include <unistd.h>

static int forward(int input, int output) {
  unsigned char bytes[512];
  ssize_t used = read(input, bytes, sizeof bytes);
  if (used <= 0) return 0;
  for (ssize_t offset = 0; offset < used;) {
    ssize_t count = write(output, bytes + offset, (size_t)(used - offset));
    if (count <= 0) return 0;
    offset += count;
  }
  return 1;
}

int main(int argc, char *argv[]) {
  const int review = argc == 2 && strcmp(argv[1], "--review") == 0;
  int master, slave;
  char path[256], go;
  if (openpty(&master, &slave, path, NULL, NULL)) return 1;
  printf("%s\n", path);
  fflush(stdout);
  if (!review && read(STDIN_FILENO, &go, 1) != 1) return 0;
  close(slave);
  for (;;) {
    fd_set ready;
    FD_ZERO(&ready);
    FD_SET(STDIN_FILENO, &ready);
    FD_SET(master, &ready);
    if (select(master + 1, &ready, NULL, NULL, NULL) <= 0) break;
    if (FD_ISSET(STDIN_FILENO, &ready) && !forward(STDIN_FILENO, master)) break;
    if (FD_ISSET(master, &ready) && !forward(master, STDOUT_FILENO)) {
      if (!review) break;
      usleep(5000);
    }
  }
  close(master);
  return 0;
}
