// Minimal stand-in for the Arduino core, only so that main.cpp and the hardware layer can be syntax-checked on a laptop.
#pragma once
#include <stdint.h>
#include <stdio.h>

#define OUTPUT 1
#define INPUT 0
#define LOW 0
#define HIGH 1

inline void pinMode(uint8_t, uint8_t) {}
inline void digitalWrite(uint8_t, uint8_t) {}
inline int digitalRead(uint8_t) { return HIGH; }
inline uint32_t millis() { return 0; }
inline uint32_t micros() { return 0; }

struct SerialStub {
  void begin(unsigned long) {}
  void println(const char* s) { puts(s); }
  template <typename... A> void printf(const char* f, A... a) { ::printf(f, a...); }
  int available() { return 0; }
  int read() { return -1; }
};
static SerialStub Serial;
