#include "http_server.hpp"
#include <iostream>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <cstring>
#include <sstream>
#include <thread>

HttpServer::HttpServer(int port) : port_(port) {}

void HttpServer::get(const std::string& path, RouteHandler handler) {
    getRoutes_[path] = std::move(handler);
}

void HttpServer::post(const std::string& path, RouteHandler handler) {
    postRoutes_[path] = std::move(handler);
}

void HttpServer::del(const std::string& path, RouteHandler handler) {
    deleteRoutes_[path] = std::move(handler);
}

static std::string parseRequestPath(const std::string& requestLine) {
    size_t s = requestLine.find(' ');
    size_t e = requestLine.find(' ', s + 1);
    if (s == std::string::npos || e == std::string::npos) return "/";
    return requestLine.substr(s + 1, e - s - 1);
}

static std::string parseMethod(const std::string& requestLine) {
    size_t s = requestLine.find(' ');
    if (s == std::string::npos) return "GET";
    return requestLine.substr(0, s);
}

bool HttpServer::start() {
    int sockfd = socket(AF_INET, SOCK_STREAM, 0);
    if (sockfd < 0) {
        std::cerr << "Failed to create socket" << std::endl;
        return false;
    }

    int opt = 1;
    setsockopt(sockfd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(port_);

    if (bind(sockfd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
        std::cerr << "Failed to bind on port " << port_ << std::endl;
        close(sockfd);
        return false;
    }

    listen(sockfd, 10);
    std::cout << "Yank engine listening on port " << port_ << std::endl;

    while (true) {
        sockaddr_in clientAddr{};
        socklen_t clientLen = sizeof(clientAddr);
        int clientFd = accept(sockfd, reinterpret_cast<sockaddr*>(&clientAddr), &clientLen);
        if (clientFd < 0) continue;

        std::thread([this, clientFd]() {
            char buf[8192] = {};
            ssize_t n = recv(clientFd, buf, sizeof(buf) - 1, 0);
            if (n <= 0) { close(clientFd); return; }

            std::string request(buf, n);
            std::istringstream stream(request);
            std::string requestLine;
            std::getline(stream, requestLine);

            std::string method = parseMethod(requestLine);
            std::string path = parseRequestPath(requestLine);

            HttpRequest req;
            req.method = method;
            req.path = path;

            RouteHandler* handler = nullptr;
            if (method == "GET" && getRoutes_.count(path))
                handler = &getRoutes_[path];
            else if (method == "POST" && postRoutes_.count(path))
                handler = &postRoutes_[path];
            else if (method == "DELETE" && deleteRoutes_.count(path))
                handler = &deleteRoutes_[path];

            HttpResponse resp;
            if (handler) {
                resp = (*handler)(req);
            } else {
                resp.status = 404;
                resp.body = R"({"error":"not found"})";
            }

            std::string headers = "HTTP/1.1 " + std::to_string(resp.status) + " OK\r\n"
                "Content-Type: " + resp.contentType + "\r\n"
                "Access-Control-Allow-Origin: *\r\n"
                "Content-Length: " + std::to_string(resp.body.size()) + "\r\n"
                "Connection: close\r\n\r\n";

            send(clientFd, headers.c_str(), headers.size(), 0);
            send(clientFd, resp.body.c_str(), resp.body.size(), 0);
            close(clientFd);
        }).detach();
    }

    close(sockfd);
    return true;
}

void HttpServer::stop() {
    std::exit(0);
}
