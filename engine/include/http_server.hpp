#pragma once
#include <string>
#include <functional>
#include <map>

struct HttpRequest {
    std::string method;
    std::string path;
    std::string body;
    std::map<std::string, std::string> params;
};

struct HttpResponse {
    int status = 200;
    std::string body;
    std::string contentType = "application/json";
};

using RouteHandler = std::function<HttpResponse(const HttpRequest&)>;

class HttpServer {
public:
    explicit HttpServer(int port = 6800);

    void get(const std::string& path, RouteHandler handler);
    void post(const std::string& path, RouteHandler handler);
    void del(const std::string& path, RouteHandler handler);

    bool start();
    void stop();

private:
    int port_;
    std::map<std::string, RouteHandler> getRoutes_;
    std::map<std::string, RouteHandler> postRoutes_;
    std::map<std::string, RouteHandler> deleteRoutes_;
};
