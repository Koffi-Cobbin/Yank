#include "downloader.hpp"
#include <curl/curl.h>
#include <iostream>
#include <filesystem>

namespace fs = std::filesystem;

static size_t headerCallback(char* buffer, size_t size, size_t nitems, void* userdata) {
    auto* info = static_cast<ServerInfo*>(userdata);
    std::string header(buffer, size * nitems);

    if (header.find("Content-Length:") != std::string::npos) {
        info->contentLength = std::stoull(header.substr(16));
    } else if (header.find("Accept-Ranges: bytes") != std::string::npos) {
        info->acceptsRanges = true;
    } else if (header.find("Content-Type:") != std::string::npos) {
        info->mimeType = header.substr(14);
        if (!info->mimeType.empty() && info->mimeType.back() == '\n')
            info->mimeType.pop_back();
        if (!info->mimeType.empty() && info->mimeType.back() == '\r')
            info->mimeType.pop_back();
    }

    return size * nitems;
}

Downloader::Downloader(const DownloadConfig& config)
    : config_(config)
    , chunkManager_(config.url, 0, config.numChunks,
                    fs::path(config.outputDir) / ".yank_tmp")
    , resumeManager_(fs::path(config.outputDir) / (config.filename + ".yank"))
    , speedLimiter_(config.speedLimitBytesPerSec) {
    progress_ = { 0, 0, 0.0, 0.0, "idle" };
}

ServerInfo Downloader::probeServer(const std::string& url) {
    ServerInfo info{};
    CURL* curl = curl_easy_init();
    if (!curl) return info;

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_NOBODY, 1L);
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_MAXREDIRS, 10L);
    curl_easy_setopt(curl, CURLOPT_HEADERFUNCTION, headerCallback);
    curl_easy_setopt(curl, CURLOPT_HEADERDATA, &info);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);

    CURLcode res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
        std::cerr << "probeServer error: " << curl_easy_strerror(res) << std::endl;
    }

    curl_easy_cleanup(curl);
    return info;
}

bool Downloader::start() {
    progress_.status = "downloading";
    return chunkManager_.downloadAll();
}

bool Downloader::pause() {
    progress_.status = "paused";
    return true;
}

bool Downloader::resume() {
    progress_.status = "downloading";
    return chunkManager_.downloadAll();
}

bool Downloader::cancel() {
    progress_.status = "cancelled";
    return true;
}

DownloadProgress Downloader::getProgress() const {
    return progress_;
}
