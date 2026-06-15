#pragma once
#include <chrono>
#include <cstddef>
#include <deque>
#include <mutex>

class SpeedLimiter {
public:
    explicit SpeedLimiter(size_t maxBytesPerSec = 0);

    void throttle(size_t bytesJustWritten);
    double getCurrentSpeedBytesPerSec() const;
    double getAverageSpeedBytesPerSec() const;

private:
    size_t limit_;
    std::chrono::steady_clock::time_point windowStart_;
    size_t bytesInWindow_;

    struct SpeedSample {
        std::chrono::steady_clock::time_point time;
        size_t bytes;
    };
    std::deque<SpeedSample> samples_;
    mutable std::mutex mutex_;
};
