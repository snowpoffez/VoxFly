import os
from collections import deque

THRESHOLD = float(os.environ.get("TURBULENCE_THRESHOLD", 5.0))
HISTORY_SIZE = 5


class TurbulenceDetector:
    """Flags turbulence when the vertical rate oscillates (sign flips) with at
    least one spike above the threshold, or when the debug flag is set."""

    def __init__(self):
        self.history = deque(maxlen=HISTORY_SIZE)
        self.debug_flag = False

    def update(self, vertical_rate):
        if vertical_rate is not None:
            self.history.append(vertical_rate)

    def is_turbulent(self):
        if self.debug_flag:
            return True
        if len(self.history) < 2:
            return False
        magnitudes = [abs(v) for v in self.history]
        signs = [1 if v >= 0 else -1 for v in self.history]
        sign_changes = sum(
            1 for i in range(1, len(signs)) if signs[i] != signs[i - 1]
        )
        return sign_changes >= 2 and max(magnitudes) > THRESHOLD

    def set_debug(self, value: bool):
        self.debug_flag = value
