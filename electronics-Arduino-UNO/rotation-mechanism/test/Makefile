# Tests for the rotation mechanism (Arduino Uno sketch folder). Run with: make
# Needs a C++ compiler. No Arduino and no hardware.
CXX ?= g++
CXXFLAGS ?= -std=c++11 -Wall -Wextra -Werror -O1
SK := ..
SOURCES := $(SK)/rotation.cpp $(SK)/colors.cpp test_main.cpp

all: build/test_main check-sketch
	./build/test_main

# The .ino sketch and the hardware file need the Arduino library, so they cannot run on a laptop.
# We only check that they compile, using a tiny fake Arduino.h from arduino_stub/.
check-sketch:
	$(CXX) -std=c++11 -Wall -Wextra -fsyntax-only -x c++ -include Arduino.h -Iarduino_stub -I$(SK) $(SK)/rotation-mechanism.ino

build/test_main: $(SOURCES) fake_drive.h $(wildcard $(SK)/*.h)
	mkdir -p build
	$(CXX) $(CXXFLAGS) -I$(SK) $(SOURCES) -o $@

clean:
	rm -rf build

.PHONY: all clean check-sketch
