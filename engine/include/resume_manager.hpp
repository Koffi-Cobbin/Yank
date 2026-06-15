#pragma once
#include <string>
#include <filesystem>
#include <vector>
#include "chunk_manager.hpp"

struct DownloadMetadata {
    std::string url;
    size_t totalSize;
    std::string filename;
    std::vector<Chunk> chunks;
};

class ResumeManager {
public:
    explicit ResumeManager(const std::filesystem::path& metadataPath);

    void save(const DownloadMetadata& metadata);
    DownloadMetadata load();
    bool exists() const;
    void remove();

private:
    std::filesystem::path metadataPath_;
};
