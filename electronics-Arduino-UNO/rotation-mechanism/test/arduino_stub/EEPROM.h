// Minimal stand-in for the Arduino Uno EEPROM library, only for the syntax check on a laptop.
// It has no begin() and no commit() on purpose: the Uno's EEPROM does not have them.
#pragma once
#include <stdint.h>
#include <stddef.h>

struct EEPROMClass {
  uint8_t read(int) { return 0xFF; }
  void write(int, uint8_t) {}
  void update(int, uint8_t) {}
};
static EEPROMClass EEPROM;
