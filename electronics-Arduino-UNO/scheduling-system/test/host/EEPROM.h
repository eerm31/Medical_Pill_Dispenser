// EEPROM.h
// The Uno's 1024 bytes of memory as a plain array that keeps its content for the whole test run.

#ifndef HOST_EEPROM_H
#define HOST_EEPROM_H

#include <stdint.h>

struct HostEeprom {
    uint8_t bytes[1024];
    HostEeprom() {
        for (int i = 0; i < 1024; i++) {
            bytes[i] = 0xFF;   // erased memory
        }
    }
    uint8_t read(int address) { return bytes[address]; }
    void update(int address, uint8_t value) { bytes[address] = value; }
};

extern HostEeprom EEPROM;

#endif
