"""
Circuit Breaker pattern implementation for isolating downstream failures.

Supports both synchronous and asynchronous functions, thread-safe state transitions
(CLOSED -> OPEN -> HALF_OPEN -> CLOSED), recovery timeouts, and failure thresholds.
"""

from __future__ import annotations

import asyncio
import inspect
import logging
import threading
import time
from functools import wraps
from typing import Any, Callable

logger = logging.getLogger(__name__)


class CircuitBreakerOpenException(Exception):
    """Raised when an operation is attempted while the circuit breaker is in OPEN state."""

    def __init__(self, breaker_name: str, retry_after: float):
        self.breaker_name = breaker_name
        self.retry_after = round(max(0.0, retry_after), 1)
        super().__init__(
            f"Circuit breaker '{breaker_name}' is OPEN. Retry after {self.retry_after}s."
        )


class CircuitBreaker:
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        success_threshold: int = 2,
    ) -> None:
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = float(recovery_timeout)
        self.success_threshold = success_threshold

        self.state = "CLOSED"
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = 0.0
        self.lock = threading.Lock()

    def _before_call(self) -> None:
        with self.lock:
            if self.state == "OPEN":
                elapsed = time.time() - self.last_failure_time
                if elapsed > self.recovery_timeout:
                    self.state = "HALF_OPEN"
                    logger.info(
                        "Circuit breaker '%s' transitioned to HALF_OPEN (probe allowed)",
                        self.name,
                    )
                else:
                    retry_after = self.recovery_timeout - elapsed
                    raise CircuitBreakerOpenException(self.name, retry_after)

    def _on_success(self) -> None:
        with self.lock:
            if self.state == "HALF_OPEN":
                self.success_count += 1
                if self.success_count >= self.success_threshold:
                    self.state = "CLOSED"
                    self.failure_count = 0
                    self.success_count = 0
                    logger.info(
                        "Circuit breaker '%s' transitioned to CLOSED (healthy)",
                        self.name,
                    )
            elif self.state == "CLOSED":
                self.failure_count = 0

    def _on_failure(self) -> None:
        with self.lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if (
                self.state == "HALF_OPEN"
                or self.failure_count >= self.failure_threshold
            ):
                self.state = "OPEN"
                logger.warning(
                    "Circuit breaker '%s' tripped to OPEN (failures: %d/%d)",
                    self.name,
                    self.failure_count,
                    self.failure_threshold,
                )

    def call(self, func: Callable, *args: Any, **kwargs: Any) -> Any:
        """Execute a synchronous function through the circuit breaker."""
        self._before_call()
        try:
            result = func(*args, **kwargs)
        except Exception:
            self._on_failure()
            raise
        self._on_success()
        return result

    async def async_call(self, func: Callable, *args: Any, **kwargs: Any) -> Any:
        """Execute an asynchronous coroutine through the circuit breaker."""
        self._before_call()
        try:
            if inspect.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = await asyncio.to_thread(func, *args, **kwargs)
        except Exception:
            self._on_failure()
            raise
        self._on_success()
        return result


def with_circuit_breaker(
    name: str = "default",
    failure_threshold: int = 5,
    recovery_timeout: float = 30.0,
    success_threshold: int = 2,
) -> Callable:
    cb = CircuitBreaker(
        name=name,
        failure_threshold=failure_threshold,
        recovery_timeout=recovery_timeout,
        success_threshold=success_threshold,
    )

    def decorator(func: Callable) -> Callable:
        if inspect.iscoroutinefunction(func):

            @wraps(func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                return await cb.async_call(func, *args, **kwargs)

            async_wrapper.circuit_breaker = cb
            return async_wrapper
        else:

            @wraps(func)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                return cb.call(func, *args, **kwargs)

            sync_wrapper.circuit_breaker = cb
            return sync_wrapper

    return decorator
