#include <cassert>
#include <iostream>
#include "chunk_manager.hpp"

void testSplitFile() {
    ChunkManager cm("http://example.com/file", 1000, 4, "/tmp/yank_test");
    auto chunks = cm.splitFile(1000, 4);

    assert(chunks.size() == 4);
    assert(chunks[0].byteStart == 0);
    assert(chunks[0].byteEnd == 249);
    assert(chunks[1].byteStart == 250);
    assert(chunks[1].byteEnd == 499);
    assert(chunks[3].byteEnd == 999);

    for (const auto& c : chunks) {
        assert(c.status == ChunkStatus::PENDING);
        assert(c.bytesDownloaded == 0);
    }

    std::cout << "testSplitFile PASSED" << std::endl;
}

int main() {
    testSplitFile();
    std::cout << "All tests passed." << std::endl;
    return 0;
}
