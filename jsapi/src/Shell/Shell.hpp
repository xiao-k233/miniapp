// Shell.hpp
#pragma once
#include <string>
#include <tuple>

class Shell {
public:
    std::string exec(const std::string& cmd);
    std::tuple<std::string, int> execWithExitCode(const std::string& cmd);
};