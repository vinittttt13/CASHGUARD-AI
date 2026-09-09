import threading
import time
import logging
from functools import wraps

logger = logging.getLogger(__name__)

class CircuitBreaker:
    def __init__(self, name: str, failure_threshold: int = 5, recovery_timeout: int = 30, success_threshold: int = 2):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold
        
        self.state = "CLOSED"
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = 0
        self.lock = threading.Lock()
        
    def call(self, func, *args, **kwargs):
        with self.lock:
            if self.state == "OPEN":
                if time.time() - self.last_failure_time > self.recovery_timeout:
                    self.state = "HALF_OPEN"
                    logger.info(f"Circuit breaker {self.name} transitioned to HALF_OPEN")
                else:
                    raise Exception(f"Circuit breaker {self.name} is OPEN")
                    
        try:
            result = func(*args, **kwargs)
        except Exception as e:
            with self.lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                if self.state == "HALF_OPEN" or self.failure_count >= self.failure_threshold:
                    self.state = "OPEN"
                    logger.info(f"Circuit breaker {self.name} transitioned to OPEN")
            raise e
            
        with self.lock:
            if self.state == "HALF_OPEN":
                self.success_count += 1
                if self.success_count >= self.success_threshold:
                    self.state = "CLOSED"
                    self.failure_count = 0
                    self.success_count = 0
                    logger.info(f"Circuit breaker {self.name} transitioned to CLOSED")
            elif self.state == "CLOSED":
                self.failure_count = 0
                
        return result

def with_circuit_breaker(name='default', failure_threshold=5, recovery_timeout=30):
    cb = CircuitBreaker(name, failure_threshold, recovery_timeout)
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            return cb.call(func, *args, **kwargs)
        return wrapper
    return decorator
