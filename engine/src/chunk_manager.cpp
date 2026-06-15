#include "chunk_manager.hpp"
#include <curl/curl.h>
#include <fstream>
#include <iostream>
#include <stdexcept>

ThreadPool::ThreadPool(size_t numThreads) {
    for (size_t i = 0; i < numThreads; ++i) {
        workers_.emplace_back([this](std::stop_token st) {
            while (!st.stop_requested()) {
                std::function<void()> task;
                {
                    std::unique_lock<std::mutex> lock(mutex_);
                    cv_.wait(lock, [this, &st] {
                        return !taskQueue_.empty() || st.stop_requested();
                    });
                    if (st.stop_requested() && taskQueue_.empty()) return;
                    task = std::move(taskQueue_.front());
                    taskQueue_.pop();
                }
                task();
                {
                    std::unique_lock<std::mutex> lock(mutex_);
                    --activeTasks_;
                    if (activeTasks_ == 0) doneCv_.notify_all();
                }
            }
        });
    }
}

ThreadPool::~ThreadPool() {
    stop_ = true;
    cv_.notify_all();
}

void ThreadPool::enqueue(std::function<void()> task) {
    {
        std::unique_lock<std::mutex> lock(mutex_);
        ++activeTasks_;
        taskQueue_.push(std::move(task));
    }
    cv_.notify_one();
}

void ThreadPool::waitAll() {
    std::unique_lock<std::mutex> lock(mutex_);
    doneCv_.wait(lock, [this] { return activeTasks_ == 0; });
}

static size_t writeCallback(void* ptr, size_t size, size_t nmemb, void* userdata) {
    auto* file = static_cast<std::ofstream*>(userdata);
    file->write(static_cast<char*>(ptr), size * nmemb);
    return size * nmemb;
}

ChunkManager::ChunkManager(const std::string& url, size_t totalSize,
                            int numChunks, const std::filesystem::path& tempDir)
    : url_(url), totalSize_(totalSize), numChunks_(numChunks), tempDir_(tempDir) {
    std::filesystem::create_directories(tempDir_);
}

std::vector<Chunk> ChunkManager::splitFile(size_t totalSize, int numChunks) {
    std::vector<Chunk> chunks;
    size_t chunkSize = totalSize / numChunks;
    for (int i = 0; i < numChunks; ++i) {
        Chunk c;
        c.id = i;
        c.byteStart = i * chunkSize;
        c.byteEnd = (i == numChunks - 1) ? totalSize - 1 : c.byteStart + chunkSize - 1;
        c.bytesDownloaded = 0;
        c.status = ChunkStatus::PENDING;
        c.tempFilePath = tempDir_ / ("chunk_" + std::to_string(i) + ".part");
        chunks.push_back(c);
    }
    return chunks;
}

bool ChunkManager::downloadChunk(Chunk& chunk) {
    CURL* curl = curl_easy_init();
    if (!curl) return false;

    std::ofstream file(chunk.tempFilePath, std::ios::binary | std::ios::app);
    if (!file.is_open()) {
        curl_easy_cleanup(curl);
        return false;
    }

    std::string range = std::to_string(chunk.byteStart + chunk.bytesDownloaded) +
                        "-" + std::to_string(chunk.byteEnd);

    curl_easy_setopt(curl, CURLOPT_URL, url_.c_str());
    curl_easy_setopt(curl, CURLOPT_RANGE, range.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &file);
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);

    {
        std::lock_guard<std::mutex> lock(mutex_);
        chunk.status = ChunkStatus::DOWNLOADING;
    }

    CURLcode res = curl_easy_perform(curl);
    curl_easy_cleanup(curl);
    file.close();

    bool success = (res == CURLE_OK);
    {
        std::lock_guard<std::mutex> lock(mutex_);
        chunk.status = success ? ChunkStatus::DONE : ChunkStatus::FAILED;
    }
    return success;
}

bool ChunkManager::downloadAll() {
    if (totalSize_ == 0) return false;

    chunks_ = splitFile(totalSize_, numChunks_);
    ThreadPool pool(std::min((size_t)numChunks_, (size_t)16));

    for (auto& chunk : chunks_) {
        pool.enqueue([this, &chunk]() {
            downloadChunk(chunk);
        });
    }

    pool.waitAll();

    for (const auto& chunk : chunks_) {
        if (chunk.status != ChunkStatus::DONE) return false;
    }
    return true;
}
