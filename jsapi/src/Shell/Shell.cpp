// Shell.cpp
#include "Shell.hpp"
#include <cstdio>
#include <memory>
#include <array>
#include <stdexcept>
#include <cstdlib>
#include <sys/wait.h>
#include <unistd.h>
#include <memory>

std::string Shell::exec(const std::string& cmd)
{
    std::array<char, 256> buffer;
    std::string result;

    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe)
        throw std::runtime_error("popen failed");

    while (fgets(buffer.data(), buffer.size(), pipe) != nullptr)
        result += buffer.data();

    pclose(pipe);
    return result;
}

std::tuple<std::string, int> Shell::execWithExitCode(const std::string& cmd)
{
    std::array<char, 256> buffer;
    std::string result;
    
    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe)
        throw std::runtime_error("popen failed");

    while (fgets(buffer.data(), buffer.size(), pipe) != nullptr)
        result += buffer.data();

    int status = pclose(pipe);
    int exitCode = WIFEXITED(status) ? WEXITSTATUS(status) : -1;
    
    return std::make_tuple(result, exitCode);
}