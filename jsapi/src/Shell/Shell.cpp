#include "Shell.hpp"
#include <cstdio>
#include <memory>
#include <array>
#include <stdexcept>

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
