"""
Unit tests for the CircuitBreaker utility in CASHGUARD-AI.
Tests verify state transitions: CLOSED -> OPEN -> HALF_OPEN -> CLOSED and failure rollbacks.
"""

import time
import pytest
from app.utils.circuit_breaker import CircuitBreaker, CircuitBreakerOpenException


def test_circuit_breaker_normal_closed():
    breaker = CircuitBreaker("test_service", failure_threshold=3, recovery_timeout=0.2)
    assert breaker.state == "CLOSED"

    result = breaker.call(lambda x, y: x + y, 2, 3)
    assert result == 5
    assert breaker.state == "CLOSED"
    assert breaker.failure_count == 0


def test_circuit_breaker_trips_to_open():
    breaker = CircuitBreaker("test_tripping", failure_threshold=2, recovery_timeout=0.2)

    def failing_fn():
        raise RuntimeError("Service unavailable")

    # 1st failure
    with pytest.raises(RuntimeError):
        breaker.call(failing_fn)
    assert breaker.state == "CLOSED"
    assert breaker.failure_count == 1

    # 2nd failure -> trips to OPEN
    with pytest.raises(RuntimeError):
        breaker.call(failing_fn)
    assert breaker.state == "OPEN"

    # Subsequent call rejected immediately
    with pytest.raises(CircuitBreakerOpenException) as exc_info:
        breaker.call(lambda: "success")
    assert "is OPEN" in str(exc_info.value)


def test_circuit_breaker_half_open_recovery():
    breaker = CircuitBreaker(
        "test_recovery", failure_threshold=2, recovery_timeout=0.1, success_threshold=2
    )

    def failing_fn():
        raise RuntimeError("fail")

    # Trip breaker
    for _ in range(2):
        try:
            breaker.call(failing_fn)
        except RuntimeError:
            pass
    assert breaker.state == "OPEN"

    # Wait for recovery timeout
    time.sleep(0.15)

    # 1st probe call succeeds -> enters HALF_OPEN
    res1 = breaker.call(lambda: "ok1")
    assert res1 == "ok1"
    assert breaker.state == "HALF_OPEN"
    assert breaker.success_count == 1

    # 2nd probe call succeeds -> reaches success_threshold (2) -> recovers to CLOSED
    res2 = breaker.call(lambda: "ok2")
    assert res2 == "ok2"
    assert breaker.state == "CLOSED"
    assert breaker.failure_count == 0
    assert breaker.success_count == 0


def test_circuit_breaker_half_open_failure_re_trips():
    breaker = CircuitBreaker(
        "test_retrip", failure_threshold=2, recovery_timeout=0.1, success_threshold=2
    )

    for _ in range(2):
        try:
            breaker.call(lambda: 1 / 0)
        except ZeroDivisionError:
            pass
    assert breaker.state == "OPEN"

    time.sleep(0.15)

    # Failure during probe -> immediately re-trips to OPEN
    with pytest.raises(ZeroDivisionError):
        breaker.call(lambda: 1 / 0)
    assert breaker.state == "OPEN"
