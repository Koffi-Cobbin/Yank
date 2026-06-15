cmake_minimum_required(VERSION 3.20)
project(yank_engine VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(CURL REQUIRED)

add_executable(yank_engine
    src/main.cpp
    src/downloader.cpp
    src/chunk_manager.cpp
    src/resume_manager.cpp
    src/file_assembler.cpp
    src/speed_limiter.cpp
    src/http_server.cpp
)

target_include_directories(yank_engine PRIVATE include)
target_link_libraries(yank_engine PRIVATE CURL::libcurl)

install(TARGETS yank_engine DESTINATION bin)
