"""Unit tests for counter adjust clamp helpers (no DB / app settings)."""

from __future__ import annotations

from types import SimpleNamespace


def clamp_counter_value(counter, value: int) -> int:
    if counter.min_value is not None and value < counter.min_value:
        value = int(counter.min_value)
    if counter.max_value is not None and value > counter.max_value:
        value = int(counter.max_value)
    return int(value)


def apply_counter_delta(counter, delta: int) -> tuple[int, int, int]:
    old_value = int(counter.value or 0)
    new_value = clamp_counter_value(counter, old_value + int(delta))
    applied = new_value - old_value
    counter.value = new_value
    return old_value, new_value, applied


def _counter(*, value=0, min_value=None, max_value=None):
    return SimpleNamespace(value=value, min_value=min_value, max_value=max_value)


def test_clamp_counter_value_respects_bounds():
    c = _counter(value=5, min_value=0, max_value=10)
    assert clamp_counter_value(c, -3) == 0
    assert clamp_counter_value(c, 99) == 10
    assert clamp_counter_value(c, 7) == 7


def test_apply_counter_delta_clamps_and_returns_applied():
    c = _counter(value=8, min_value=0, max_value=10)
    old, new, applied = apply_counter_delta(c, 5)
    assert old == 8
    assert new == 10
    assert applied == 2
    assert c.value == 10


def test_apply_counter_delta_zero_when_already_at_bound():
    c = _counter(value=0, min_value=0, max_value=10)
    old, new, applied = apply_counter_delta(c, -3)
    assert old == 0
    assert new == 0
    assert applied == 0
    assert c.value == 0


def test_apply_counter_delta_positive():
    c = _counter(value=3, min_value=None, max_value=None)
    old, new, applied = apply_counter_delta(c, 4)
    assert (old, new, applied) == (3, 7, 4)
    assert c.value == 7
