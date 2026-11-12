// Arduino.h
// A tiny fake of the Arduino library so the real sketch (src/scheduling-system.ino) can run on the laptop.
// Time only moves when the test moves it, Serial output is kept with the time it was printed, EEPROM is an array.

#ifndef HOST_ARDUINO_H
#define HOST_ARDUINO_H

#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <string>
#include <vector>

class __FlashStringHelper;
#define F(text) (reinterpret_cast<const __FlashStringHelper*>(text))

#define OUTPUT 1
#define INPUT_PULLUP 2
#define LOW 0
#define HIGH 1

extern uint32_t g_micros;        // the clock of the fake board, in microseconds
extern long g_pinWrites;         // how many times a motor pin was written (0 means the cartridge did not move)

inline uint32_t micros() { return g_micros; }
inline uint32_t millis() { return g_micros / 1000UL; }
inline void pinMode(int, int) {}
inline void digitalWrite(int, int) { g_pinWrites++; }
inline int digitalRead(int) { return HIGH; }

struct LoggedLine {
    uint32_t atUs;
    std::string text;
};

class HostSerial {
public:
    std::vector<LoggedLine> lines;   // every finished line of output
    std::string current;
    std::string input;               // what the "computer" typed and the sketch has not read yet

    void begin(long) {}
    int available() { return (int)input.size(); }
    int read() {
        int c = (unsigned char)input[0];
        input.erase(0, 1);
        return c;
    }
    void type(const char* line) { input += line; input += '\n'; }

    size_t print(const char* s) { current += s; return 0; }
    size_t print(const __FlashStringHelper* s) { current += reinterpret_cast<const char*>(s); return 0; }
    size_t print(char c) { current += c; return 0; }
    size_t print(unsigned char v) { current += std::to_string((unsigned)v); return 0; }
    size_t print(int v) { current += std::to_string(v); return 0; }
    size_t print(unsigned v) { current += std::to_string(v); return 0; }
    size_t print(long v) { current += std::to_string(v); return 0; }
    size_t print(unsigned long v) { current += std::to_string(v); return 0; }

    template <typename T>
    size_t println(T v) { print(v); return println(); }
    size_t println() {
        lines.push_back({g_micros, current});
        current.clear();
        return 0;
    }
};

extern HostSerial Serial;

#endif
