# Tests for the scheduling system. Run with: make   (needs a C++ compiler, no Arduino, no hardware)
# The automatic-rotation tests use the rotation code from ../../rotation-mechanism
CXX ?= g++
CXXFLAGS ?= -std=c++11 -Wall -Wextra -Werror -O1
FW := ../firmware
ROT := ../../rotation-mechanism
INCLUDES := -I$(FW) -I$(ROT)/firmware
SOURCES := $(FW)/core/schedule.cpp $(ROT)/firmware/core/auto_rotate.cpp $(FW)/core/cartridge_turn.cpp $(ROT)/firmware/core/rotation.cpp $(ROT)/firmware/core/colors.cpp test_main.cpp

all: build/test_main check-firmware
	./build/test_main

# main.cpp cannot run on a laptop, but it must at least compile against a tiny fake Arduino.h.
check-firmware:
	$(CXX) -std=c++11 -Wall -Wextra -fsyntax-only -I$(ROT)/test/arduino_stub $(INCLUDES) $(FW)/main.cpp

build/test_main: $(SOURCES) $(ROT)/test/fake_drive.h $(wildcard $(FW)/core/*.h) $(wildcard $(ROT)/firmware/core/*.h)
	mkdir -p build
	$(CXX) $(CXXFLAGS) $(INCLUDES) $(SOURCES) -o $@

clean:
	rm -rf build

# The real program on the laptop with a fake Arduino, clock and EEPROM: the 5 pills / 2 per dose example.
dispensing: build/test_dispensing
	./build/test_dispensing

build/test_dispensing: test_dispensing.cpp $(FW)/main.cpp $(FW)/my_schedule.h $(wildcard $(FW)/core/*.h) $(wildcard $(FW)/core/*.cpp) $(wildcard $(FW)/hw/*.h) $(wildcard host/*.h)
	mkdir -p build
	$(CXX) -std=c++11 -Wall -Wextra -O1 -Ihost $(INCLUDES) test_dispensing.cpp $(FW)/core/schedule.cpp $(FW)/core/cartridge_turn.cpp $(FW)/core/RefillingSystem.cpp $(ROT)/firmware/core/colors.cpp -o $@

# The Refilling System alone, and then on the real program: one 30 degree move, limits, cancel, dose protection.
refill: build/test_refill
	./build/test_refill

build/test_refill: test_refill.cpp $(FW)/main.cpp $(FW)/my_schedule.h $(wildcard $(FW)/core/*.h) $(wildcard $(FW)/core/*.cpp) $(wildcard $(FW)/hw/*.h) $(wildcard host/*.h)
	mkdir -p build
	$(CXX) -std=c++11 -Wall -Wextra -O1 -DESP32_BOARD -Ihost $(INCLUDES) test_refill.cpp $(FW)/core/schedule.cpp $(FW)/core/cartridge_turn.cpp $(FW)/core/RefillingSystem.cpp $(ROT)/firmware/core/colors.cpp -o $@

.PHONY: all clean check-firmware dispensing refill
