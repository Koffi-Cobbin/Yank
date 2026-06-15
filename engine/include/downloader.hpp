#pragma once
#include <string>
#include <functional>
#include "chunk_manager.hpp"
#include "resume_manager.hpp"
#include "speed_limiter.hpp"

struct ServerInfo {
    size_t contentLength;
    bool acceptsRanges;
    std::string mimeType;
    std::string filename;
};

struct DownloadConfig {
    std::string url;
    std::string outputDir;
    std::string filename;
    int numChunks = 16;
    size_t speedLimitBytesPerSec = 0;
};

struct DownloadProgress {
    size_t totalBytes;
    size_t downloadedBytes;
    double speedBytesPerSec;
    double etaSeconds;
    std::string status;
};

class Downloader {
public:
    explicit Downloader(const DownloadConfig& config);

    bool start();
    bool pause();
    bool resume();
    bool cancel();

    DownloadProgress getProgress() const;
    ServerInfo probeServer(const std::string& url);

private:
    DownloadConfig config_;
    ChunkManager chunkManager_;
    ResumeManager resumeManager_;
    SpeedLimiter speedLimiter_;
    DownloadProgress progress_;
};
