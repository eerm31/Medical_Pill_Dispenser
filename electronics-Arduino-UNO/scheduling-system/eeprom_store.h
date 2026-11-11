// eeprom_store.h
// Keeps the schedule and the turn settings in the Uno's memory, so they are still there after a power cut.
// Address 0 to 63: the schedule. Address 64 to 71: the turn settings.

#ifndef EEPROM_STORE_H
#define EEPROM_STORE_H

#include <Arduino.h>
#include <EEPROM.h>

#define SCHEDULE_ADDRESS 0
#define SCHEDULE_BYTES 64
#define SETTINGS_ADDRESS 64
#define SETTINGS_BYTES 8

class Store {
public:
    // call this once in setup() (the Uno needs nothing here)
    void begin() {
    }

    void read(int address, uint8_t* data, size_t length) {
        for (size_t i = 0; i < length; i++) {
            data[i] = EEPROM.read(address + i);
        }
    }

    void write(int address, const uint8_t* data, size_t length) {
        for (size_t i = 0; i < length; i++) {
            EEPROM.update(address + i, data[i]);   // update() only writes a byte that changed, the memory wears out slowly
        }
    }
};

#endif
