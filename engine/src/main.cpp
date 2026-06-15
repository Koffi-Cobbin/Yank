#include <iostream>
#include <string>
#include <csignal>
#include "http_server.hpp"
#include "downloader.hpp"

static HttpServer* g_server = nullptr;

void signalHandler(int sig) {
    if (g_server) g_server->stop();
    std::exit(0);
}

int main(int argc, char* argv[]) {
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    int port = 6800;
    if (argc > 1) port = std::stoi(argv[1]);

    HttpServer server(port);
    g_server = &server;

    server.post("/downloads", [](const HttpRequest& req) -> HttpResponse {
        return { 200, R"({"status":"queued","id":"placeholder"})" };
    });

    server.get("/downloads", [](const HttpRequest& req) -> HttpResponse {
        return { 200, R"({"downloads":[]})" };
    });

    server.get("/health", [](const HttpRequest& req) -> HttpResponse {
        return { 200, R"({"status":"ok"})" };
    });

    std::cout << "Yank engine starting on port " << port << std::endl;
    if (!server.start()) {
        std::cerr << "Failed to start HTTP server on port " << port << std::endl;
        return 1;
    }

    return 0;
}
