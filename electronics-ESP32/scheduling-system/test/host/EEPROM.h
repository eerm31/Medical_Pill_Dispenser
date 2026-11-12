// EEPROM.h
// The board's memory as a plain array that keeps its content for the whole test run.

#ifndef HOST_EEPROM_H
#define HOST_EEPROM_H

#include <stdint.h>

struct HostEeprom {
    uint8_t bytes[256];
    HostEeprom() {
        for (int i = 0; i < 256; i++) {
            bytes[i] = 0xFF;   // erased memory
        }
    }
    void begin(int) {}
    void commit() {}
    uint8_t read(int address) { return bytes[address]; }
    void write(int address, uint8_t value) { bytes[address] = value; }
};

extern HostEeprom EEPROM;

#endif
