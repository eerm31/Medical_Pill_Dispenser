// eeprom_store.h
// Keeps the schedule and the turn settings in the board's memory, so they are still there after a power cut.
// Address 0 to 63: the schedule. Address 64 to 71: the turn settings.

#ifndef EEPROM_STORE_H
#define EEPROM_STORE_H

#include <Arduino.h>
#include <EEPROM.h>

#define STORE_SIZE 128
#define SCHEDULE_ADDRESS 0
#define SCHEDULE_BYTES 64
#define SETTINGS_ADDRESS 64
#define SETTINGS_BYTES 8

class Store {
public:
    // call this once in setup()
    void begin() {
        EEPROM.begin(STORE_SIZE);
    }

    void read(int address, uint8_t* data, size_t length) {
        for (size_t i = 0; i < length; i++) {
            data[i] = EEPROM.read(address + i);
        }
    }

    void write(int address, const uint8_t* data, size_t length) {
        for (size_t i = 0; i < length; i++) {
            EEPROM.write(address + i, data[i]);
        }
        EEPROM.commit();   // on the ESP32 the bytes are only kept after commit()
    }
};

#endif
