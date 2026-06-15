#include "resume_manager.hpp"
#include <fstream>
#include <iostream>

ResumeManager::ResumeManager(const std::filesystem::path& metadataPath)
    : metadataPath_(metadataPath) {}

bool ResumeManager::exists() const {
    return std::filesystem::exists(metadataPath_);
}

void ResumeManager::save(const DownloadMetadata& metadata) {
    std::ofstream file(metadataPath_);
    if (!file.is_open()) {
        std::cerr << "ResumeManager: cannot open " << metadataPath_ << std::endl;
        return;
    }

    file << "{\n";
    file << "  \"url\": \"" << metadata.url << "\",\n";
    file << "  \"totalSize\": " << metadata.totalSize << ",\n";
    file << "  \"filename\": \"" << metadata.filename << "\",\n";
    file << "  \"chunks\": [\n";

    for (size_t i = 0; i < metadata.chunks.size(); ++i) {
        const auto& c = metadata.chunks[i];
        file << "    {\"id\":" << c.id
             << ",\"byteStart\":" << c.byteStart
             << ",\"byteEnd\":" << c.byteEnd
             << ",\"bytesDownloaded\":" << c.bytesDownloaded
             << ",\"status\":" << static_cast<int>(c.status) << "}";
        if (i + 1 < metadata.chunks.size()) file << ",";
        file << "\n";
    }

    file << "  ]\n}\n";
}

DownloadMetadata ResumeManager::load() {
    DownloadMetadata metadata;
    if (!exists()) return metadata;

    std::ifstream file(metadataPath_);
    if (!file.is_open()) return metadata;

    return metadata;
}

void ResumeManager::remove() {
    if (exists()) {
        std::filesystem::remove(metadataPath_);
    }
}
