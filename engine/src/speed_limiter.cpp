#include "speed_limiter.hpp"
#include <thread>
#include <numeric>

SpeedLimiter::SpeedLimiter(size_t maxBytesPerSec)
    : limit_(maxBytesPerSec)
    , windowStart_(std::chrono::steady_clock::now())
    , bytesInWindow_(0) {}

void SpeedLimiter::throttle(size_t bytesJustWritten) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto now = std::chrono::steady_clock::now();

    samples_.push_back({ now, bytesJustWritten });
    while (samples_.size() > 5) samples_.pop_front();

    bytesInWindow_ += bytesJustWritten;

    if (limit_ == 0) return;

    auto elapsed = std::chrono::duration<double>(now - windowStart_).count();
    if (elapsed < 1.0) {
        double expectedTime = static_cast<double>(bytesInWindow_) / limit_;
        if (expectedTime > elapsed) {
            auto sleepMs = static_cast<long long>((expectedTime - elapsed) * 1000);
            std::this_thread::sleep_for(std::chrono::milliseconds(sleepMs));
        }
    } else {
        windowStart_ = now;
        bytesInWindow_ = 0;
    }
}

double SpeedLimiter::getCurrentSpeedBytesPerSec() const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (samples_.empty()) return 0.0;

    auto now = std::chrono::steady_clock::now();
    double elapsed = std::chrono::duration<double>(now - samples_.front().time).count();
    if (elapsed <= 0) return 0.0;

    size_t total = 0;
    for (const auto& s : samples_) total += s.bytes;
    return total / elapsed;
}

double SpeedLimiter::getAverageSpeedBytesPerSec() const {
    return getCurrentSpeedBytesPerSec();
}
