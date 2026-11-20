#pragma once

#include "desktop_internet.h"

namespace vp8_daily {
struct WeatherJob {
  char host[64]{};
  WeatherLocation location;
};

struct WeatherReply {
  std::optional<InternetForecast> forecast;
  int64_t received{};
};

// The maintenance owner and HTTPS task serialize short transitions with a lock.
// The running task retains exclusive ownership until the HTTPS handle is closed.
class WeatherWork {
 public:
  bool submit(std::string_view host, WeatherLocation location) {
    if (!idle() || host.empty() || host.size() >= sizeof(job_.host)) return false;
    job_ = {};
    std::copy(host.begin(), host.end(), job_.host);
    job_.location = location;
    stage_ = Stage::queued;
    return true;
  }

  std::optional<WeatherJob> take() {
    if (stage_ != Stage::queued) return std::nullopt;
    stage_ = Stage::running;
    return job_;
  }

  bool cancelled() const { return stage_ == Stage::cancelling; }
  bool idle() const { return stage_ == Stage::idle; }

  bool cancel() {
    if (stage_ == Stage::running || cancelled()) {
      stage_ = Stage::cancelling;
      return false;
    }
    stage_ = Stage::idle;
    return true;
  }

  void finish(WeatherReply reply) {
    if (cancelled()) {
      stage_ = Stage::idle;
    } else if (stage_ == Stage::running) {
      reply_ = reply;
      stage_ = Stage::complete;
    }
  }

  std::optional<WeatherReply> collect() {
    if (stage_ != Stage::complete) return std::nullopt;
    stage_ = Stage::idle;
    return reply_;
  }

 private:
  enum class Stage { idle, queued, running, cancelling, complete };
  Stage stage_ = Stage::idle;
  WeatherJob job_;
  WeatherReply reply_;
};
} // namespace vp8_daily
