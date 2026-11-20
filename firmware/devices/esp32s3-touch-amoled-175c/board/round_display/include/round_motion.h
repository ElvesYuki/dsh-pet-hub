#pragma once
#include <array>
#include <cstdint>
#include <optional>

struct RoundMotion {
  std::array<int32_t, 3> acceleration_mg, rotation_mdps;
};

bool round_motion_start();
std::optional<RoundMotion> round_motion_read();
bool round_motion_stop();
