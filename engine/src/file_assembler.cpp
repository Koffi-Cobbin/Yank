#include "chunk_manager.hpp"
#include <fstream>
#include <filesystem>
#include <iostream>
#include <stdexcept>

void assembleFile(
    const std::vector<Chunk>& chunks,
    const std::filesystem::path& outputPath
) {
    std::ofstream out(outputPath, std::ios::binary);
    if (!out.is_open()) {
        throw std::runtime_error("assembleFile: cannot open output path: " + outputPath.string());
    }

    for (const auto& chunk : chunks) {
        if (chunk.status != ChunkStatus::DONE) {
            throw std::runtime_error("assembleFile: chunk " + std::to_string(chunk.id) + " not done");
        }
        std::ifstream in(chunk.tempFilePath, std::ios::binary);
        if (!in.is_open()) {
            throw std::runtime_error("assembleFile: cannot open chunk file: " + chunk.tempFilePath.string());
        }
        out << in.rdbuf();
        in.close();
        std::filesystem::remove(chunk.tempFilePath);
    }

    out.close();
    std::cout << "Assembly complete: " << outputPath << std::endl;
}
