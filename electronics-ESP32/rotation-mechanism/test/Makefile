# Tests for the rotation mechanism. Run with: make
# Needs a C++ compiler. No Arduino and no hardware.
CXX ?= g++
CXXFLAGS ?= -std=c++11 -Wall -Wextra -Werror -O1
FW := ../firmware
SOURCES := $(FW)/core/rotation.cpp $(FW)/core/colors.cpp test_main.cpp

all: build/test_main check-firmware
	./build/test_main

# main.cpp and the hardware file need the Arduino library, so they cannot run on a laptop.
# We only check that they compile, using a tiny fake Arduino.h from arduino_stub/.
check-firmware:
	$(CXX) -std=c++11 -Wall -Wextra -fsyntax-only -Iarduino_stub -I$(FW) $(FW)/main.cpp

build/test_main: $(SOURCES) fake_drive.h $(wildcard $(FW)/core/*.h)
	mkdir -p build
	$(CXX) $(CXXFLAGS) -I$(FW) $(SOURCES) -o $@

clean:
	rm -rf build

.PHONY: all clean check-firmware
