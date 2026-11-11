// Minimal stand-in for the EEPROM library, only for the syntax check on a laptop.
#pragma once
#include <stdint.h>
#include <stddef.h>

struct EEPROMClass {
  bool begin(size_t) { return true; }
  uint8_t read(int) { return 0xFF; }
  void write(int, uint8_t) {}
  bool commit() { return true; }
};
static EEPROMClass EEPROM;
