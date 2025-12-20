// Shell.hpp
#pragma once
#include <string>
#include <vector>

class ShellResult {
public:
    int exitCode;
    std::string output;
    std::string error;
};

class Shell {
public:
    ShellResult exec(const std::string& cmd);
    ShellResult exec(const std::string& cmd, const std::vector<std::string>& args);
    ShellResult execWithEnv(const std::string& cmd, const std::vector<std::pair<std::string, std::string>>& envVars);
};