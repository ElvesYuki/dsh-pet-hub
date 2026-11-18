/* MIT: read-only macOS power notification helper. Never requests or vetoes sleep. */
#include <CoreFoundation/CoreFoundation.h>
#include <IOKit/IOMessage.h>
#include <IOKit/pwr_mgt/IOPMLib.h>
#include <inttypes.h>
#include <poll.h>
#include <signal.h>
#include <stdbool.h>
#include <stdio.h>
#include <unistd.h>

static volatile sig_atomic_t stopping = 0;
static io_connect_t root = IO_OBJECT_NULL;
static uint64_t sequence = 0;
static void stop(int value) { (void)value; stopping = 1; }
static void emit(const char *type) {
  if (sequence == UINT64_MAX) { stopping = 1; return; }
  if (printf("{\"protocol\":\"hub-power/1\",\"type\":\"%s\",\"seq\":\"%" PRIu64 "\"}\n", type, sequence++) < 0 || fflush(stdout) != 0) stopping = 1;
}
static void notification(void *ref, io_service_t service, natural_t type, void *argument) {
  (void)ref; (void)service;
  /* Acknowledge first even if the parent pipe is unavailable; never hold up OS sleep. */
  if (type == kIOMessageCanSystemSleep || type == kIOMessageSystemWillSleep)
    IOAllowPowerChange(root, (intptr_t)argument);
  if (type == kIOMessageSystemWillSleep) emit("suspend");
  else if (type == kIOMessageSystemHasPoweredOn || type == kIOMessageSystemWillNotSleep) emit("resume");
}
int main(void) {
  signal(SIGTERM, stop); signal(SIGINT, stop); signal(SIGPIPE, SIG_IGN);
  IONotificationPortRef port = NULL; io_object_t notifier = IO_OBJECT_NULL;
  root = IORegisterForSystemPower(NULL, &port, notification, &notifier);
  if (root == IO_OBJECT_NULL || port == NULL) { fputs("power_registration_failed\n", stderr); return 2; }
  CFRunLoopSourceRef source = IONotificationPortGetRunLoopSource(port);
  if (source == NULL) { IODeregisterForSystemPower(&notifier); IOServiceClose(root); IONotificationPortDestroy(port); return 3; }
  CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopDefaultMode);
  emit("ready");
  while (!stopping) {
    CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.1, true);
    struct pollfd input = { .fd = STDIN_FILENO, .events = POLLIN | POLLHUP };
    if (poll(&input, 1, 0) > 0) { char byte; if ((input.revents & POLLHUP) || read(STDIN_FILENO, &byte, 1) <= 0) stopping = 1; }
  }
  CFRunLoopRemoveSource(CFRunLoopGetCurrent(), source, kCFRunLoopDefaultMode);
  IODeregisterForSystemPower(&notifier); IOServiceClose(root); IONotificationPortDestroy(port);
  return 0;
}
