// Pill colours and the drum stations they sit at. ASSUMED / NOT_VALIDATED concept code, no clinical or dosing claim.
#pragma once
#include <stdint.h>
#include <string.h>

namespace dispenser {

// Station order matches the simulation (docs/visualizer/rotation-controller.js): RED is the home station.
enum Color : uint8_t { RED = 0, BLUE = 1, GREEN = 2, ORANGE = 3, COLOR_COUNT = 4, NO_COLOR = 255 };

inline const char* colorName(Color c) {
  static const char* const names[] = {"red", "blue", "green", "orange"};
  return c < COLOR_COUNT ? names[c] : "none";
}

inline bool colorFromName(const char* text, Color* out) {
  for (uint8_t i = 0; i < COLOR_COUNT; i++) {
    if (strcmp(text, colorName(static_cast<Color>(i))) == 0) {
      *out = static_cast<Color>(i);
      return true;
    }
  }
  return false;
}

}  // namespace dispenser
