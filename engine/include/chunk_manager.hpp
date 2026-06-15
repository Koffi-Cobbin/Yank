#pragma once
#include <vector>
#include <string>
#include <filesystem>
#include <mutex>
#include <queue>
#include <functional>
#include <thread>
#include <condition_variable>

enum class ChunkStatus {
    PENDING,
    DOWNLOADING,
    PAUSED,
    DONE,
    FAILED
};

struct Chunk {
    size_t id;
    size_t byteStart;
    size_t byteEnd;
    size_t bytesDownloaded;
    ChunkStatus status;
    std::filesystem::path tempFilePath;
};

class ThreadPool {
public:
    explicit ThreadPool(size_t numThreads);
    ~ThreadPool();

    void enqueue(std::function<void()> task);
    void waitAll();

private:
    std::vector<std::jthread> workers_;
    std::queue<std::function<void()>> taskQueue_;
    std::mutex mutex_;
    std::condition_variable cv_;
    bool stop_ = false;
    size_t activeTasks_ = 0;
    std::condition_variable doneCv_;
};

class ChunkManager {
public:
    ChunkManager(const std::string& url, size_t totalSize, int numChunks,
                 const std::filesystem::path& tempDir);

    std::vector<Chunk> splitFile(size_t totalSize, int numChunks);
    bool downloadAll();
    bool downloadChunk(Chunk& chunk);
    void rebalanceSlowChunks();

    const std::vector<Chunk>& getChunks() const { return chunks_; }

private:
    std::string url_;
    size_t totalSize_;
    int numChunks_;
    std::filesystem::path tempDir_;
    std::vector<Chunk> chunks_;
    mutable std::mutex mutex_;
};
