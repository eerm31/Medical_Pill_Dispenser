// A fake drum for the host tests: counts half-steps and raises the Hall signal while the magnet is over the sensor.
#pragma once
#include <stdint.h>

#include "core/rotation.h"

using namespace dispenser;

// A drum with a magnet: the sensor is active for `window` steps starting at `edge` (counter-clockwise = +).
struct FakeDrive : StepperPort, HomeSensor {
  int32_t n, phys, edge, window;
  int lastDir = 0;
  long total = 0;
  bool hallDead = false, released = false;
  FakeDrive(int32_t n_, int32_t start, int32_t edge_, int32_t window_) : n(n_), phys(start), edge(edge_), window(window_) {}
  void step(int dir) override { phys = ((phys + dir) % n + n) % n; lastDir = dir; total++; released = false; }
  void release() override { released = true; }
  bool active() override { return !hallDead && ((phys - edge) % n + n) % n < window; }
  int32_t red(int32_t offsetSteps) const { return (edge + offsetSteps) % n; }
};

// Simulated time in microseconds; the tests advance it by hand.
static uint32_t clockUs = 0;
