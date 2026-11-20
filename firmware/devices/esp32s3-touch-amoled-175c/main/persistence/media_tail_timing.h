#pragma once
#include <cstdint>

namespace pet400_persist {
enum class MediaTail {
  SessionStart, SessionDeadline, PermitDeadline, FinalAck, EndAccepted, ShaBegin, ShaVerified,
  FramesVerified, RootCommitBegin, RootMarkerWritten, RootVerified, ResultBegin, ResultSent,
  HttpGet, HttpHeaders, HttpBody, Count
};
#if PET_PMA1_LAN_TIMING
void record_media_tail(MediaTail stage, uint64_t time_us = 0);
#else
inline void record_media_tail(MediaTail, uint64_t = 0) {}
#endif
}
