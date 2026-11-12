"""The UI System pages (electronics-*/scheduler-ui) set the dose schedule on the board over USB.

ASSUMED / NOT_VALIDATED. Keeps the page's rules and commands equal to the firmware, and the two boards' pages equal.
"""
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
BOARDS = {
    "uno": ROOT / "electronics-Arduino-UNO",
    "esp32": ROOT / "electronics-ESP32",
}
FIRMWARE_MAINS = {
    "uno": BOARDS["uno"] / "scheduling-system" / "src" / "scheduling-system.ino",
    "esp32": BOARDS["esp32"] / "scheduling-system" / "firmware" / "main.cpp",
}
SCHEDULE_H = BOARDS["esp32"] / "scheduling-system" / "firmware" / "core" / "schedule.h"


def _read(path):
    return path.read_text(encoding="utf-8")


def _num(pattern, text):
    return int(re.search(pattern, text).group(1))


def test_both_boards_use_the_same_page_code():
    for name in ("scheduler.js", "scheduler.css", "refill.js", "refill.css", "wizard.js", "wizard.css"):
        assert _read(BOARDS["uno"] / "scheduler-ui" / name) == _read(BOARDS["esp32"] / "scheduler-ui" / name), name


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_empty_schedule_fill_button_opens_the_setup_window(board):
    ui = BOARDS[board] / "scheduler-ui"
    html, js, wizard = _read(ui / "index.html"), _read(ui / "scheduler.js"), _read(ui / "wizard.js")
    assert 'src="wizard.js"' in html and 'href="wizard.css"' in html
    assert "new CustomEvent('ui:setup')" in js and "addEventListener('ui:setup'" in wizard
    assert "className = 'fill-btn shimmer'" in js   # shimmers whenever there is no schedule
    for label in ("'Renew'", "'Edit'", "'Cancel'", "'Confirm'", "'Add'"):
        assert label in wizard, label


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_a_dose_the_cartridge_cannot_give_pauses_the_schedule(board):
    ui = BOARDS[board] / "scheduler-ui"
    js, html = _read(ui / "scheduler.js"), _read(ui / "index.html")
    assert "'PAUSED'" in js and 'id="pauseWarn"' in html and 'id="pauseFillBtn"' in html
    assert "endSchedule('FINISHED'" not in js   # the board's "schedule FINISHED" line pauses, it does not remove the schedule


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_each_pill_is_confirmed_before_it_counts_and_the_schedule_waits_only_while_filling(board):
    ui = BOARDS[board] / "scheduler-ui"
    refill, js = _read(ui / "refill.js"), _read(ui / "scheduler.js")
    assert "'+ Add'" not in refill and "aria-label': 'Add a pill'" in refill and "plusIcon()" in refill
    assert "Did you put the pill in?" in refill and "phase = 'asking'" in refill
    assert "addBtn.disabled = !ready || phase !== 'idle'" in refill   # locked until the person answers
    assert "doneBtn.disabled = !ready || added < 1 || phase !== 'idle'" in refill   # Done needs a confirmed pill
    assert "UI.setRefilling(open)" in refill and "setRefilling:" in js
    # the plus waits 1 s and asks; the cartridge turns right after the Yes, not before the next plus
    assert "if (added < room()) turnNext();" in refill and "}, 1000);" in refill and "dirty" not in refill
    assert "RETURNING" in refill and "Putting the cartridge back" in refill   # after Done it waits for the cartridge to come back
    assert "count.textContent = String(added)" in refill   # the count is just the number
    assert 'strcmp(sub, "next") == 0' in _read(FIRMWARE_MAINS[board])
    # the total is 11: dispensed = 11 - pills left, the cartridge turns (dispensed - 1) times first, none when it is empty
    assert "var dispensed = pills === 0 ? 0 : Math.max(0, MAX - pills)" in refill and "MAX = 11" in refill
    assert "UI.send('refill empty')" not in refill and "In the cartridge now" not in refill
    assert "UI.send('refill start ' + Math.max(0, dispensed - 1))" in refill
    assert "startRefill(value != NULL ? atoi(value) : 0)" in _read(FIRMWARE_MAINS[board])


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_cancelled_refill_waits_until_the_pills_are_taken_out(board):
    refill = _read(BOARDS[board] / "scheduler-ui" / "refill.js")
    assert "Take the pills out" in refill and "takeOutSure" in refill and "setTakeOut(null)" in refill


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_cartridge_inventory_block_is_not_rendered(board):
    html = _read(BOARDS[board] / "scheduler-ui" / "index.html")
    assert "Cartridge Inventory" not in html
    assert 'id="ringState"' not in html
    assert 'id="ringText"' not in html


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_page_rules_match_the_firmware(board):
    js = _read(BOARDS[board] / "scheduler-ui" / "scheduler.js")
    header = _read(SCHEDULE_H)
    assert _num(r"MAX_ENTRIES = (\d+)", js) == _num(r"#define MAX_ENTRIES (\d+)", header)
    assert _num(r"MAX_PILLS = (\d+)", js) == _num(r"#define MAX_PILLS (\d+)", header)
    html = _read(BOARDS[board] / "scheduler-ui" / "index.html")
    assert 'max="%d"' % _num(r"#define MAX_PILLS (\d+)", header) in html


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_every_command_the_page_sends_exists_in_the_firmware(board):
    js = _read(BOARDS[board] / "scheduler-ui" / "scheduler.js")
    firmware = _read(FIRMWARE_MAINS[board])
    sent = set(re.findall(r"(?:send|next)\('([a-z]+)[ ']", js))
    assert {"time", "clear", "add", "save", "list"} <= sent
    for command in sent:
        assert 'strcmp(command, "%s") == 0' % command in firmware, command


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_page_reads_the_lines_the_firmware_prints(board):
    js = _read(BOARDS[board] / "scheduler-ui" / "scheduler.js")
    firmware = _read(FIRMWARE_MAINS[board])
    for word in ("clock ", "saved "):
        assert word in firmware, word
    assert "/^clock /" in js and "/^saved " in js


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_board_keeps_the_schedule_in_memory(board):
    firmware = _read(FIRMWARE_MAINS[board])
    assert "schedule.load(" in firmware and "schedule.save(" in firmware


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_every_element_the_page_uses_exists(board):
    js = _read(BOARDS[board] / "scheduler-ui" / "scheduler.js")
    html = _read(BOARDS[board] / "scheduler-ui" / "index.html")
    for element_id in set(re.findall(r"\$\('([A-Za-z0-9]+)'\)", js)):
        assert 'id="%s"' % element_id in html, element_id
    assert 'src="scheduler.js"' in html and 'href="scheduler.css"' in html


@pytest.mark.parametrize("board", sorted(BOARDS))
def test_page_stays_offline(board):
    for name in ("index.html", "scheduler.js", "scheduler.css"):
        text = _read(BOARDS[board] / "scheduler-ui" / name)
        assert not re.search(r"https?://|eval\(|new Function|innerHTML", text), name
