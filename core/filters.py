import time

class PIDFilter:
    def __init__(self, kp, ki, kd):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.prev_error = 0
        self.integral = 0

    def update(self, target, current, dt):
        if dt <= 0: return current
        error = target - current
        self.integral += error * dt
        derivative = (error - self.prev_error) / dt
        output = (self.kp * error) + (self.ki * self.integral) + (self.kd * derivative)
        self.prev_error = error
        return output

class DeadzoneManager:
    def __init__(self, base_deadzone=0.05):
        self.base_deadzone = base_deadzone
        self.current_deadzone = base_deadzone

    def apply(self, value):
        if abs(value) < self.current_deadzone:
            return 0.0
        return value

class KalmanFilter:
    """
    Advanced stabilization filter for input signals.
    """
    def __init__(self, process_variance=1e-5, measurement_variance=1e-2):
        self.process_variance = process_variance
        self.measurement_variance = measurement_variance
        self.posteri_estimate = 0.0
        self.posteri_error_estimate = 1.0

    def update(self, measurement):
        priori_estimate = self.posteri_estimate
        priori_error_estimate = self.posteri_error_estimate + self.process_variance

        blending_factor = priori_error_estimate / (priori_error_estimate + self.measurement_variance)
        self.posteri_estimate = priori_estimate + blending_factor * (measurement - priori_estimate)
        self.posteri_error_estimate = (1 - blending_factor) * priori_error_estimate

        return self.posteri_estimate
