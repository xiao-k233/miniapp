// Copyright (C) 2025 Langning Chen
//
// This file is part of miniapp.
//
// miniapp is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// miniapp is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with miniapp.  If not, see <https://www.gnu.org/licenses/>.

#include "AI.hpp"
#include "strUtils.hpp"
#include <Exceptions/NetworkError.hpp>
#include <iostream>
#include <sstream>
#include <regex>
#include <chrono>

AI::AI()
{
    std::lock_guard<std::mutex> settingsLock(settingsMutex);
    std::lock_guard<std::mutex> conversationLock(conversationMutex);

    conversationManager.loadApiSettings(apiKey, baseUrl, model, maxTokens, temperature, topP, systemPrompt);

    auto conversationsResponse = conversationManager.getConversationList();
    if (conversationsResponse.empty())
    {
        conversationManager.createConversation("默认对话", conversationId);

        std::unique_lock<std::shared_mutex> stateLock(stateMutex);
        currentNodeId = rootNodeId = strUtils::randomId();
        nodeMap[currentNodeId] = std::make_unique<ConversationNode>(
            currentNodeId, ConversationNode::ROLE_SYSTEM, systemPrompt, "");
        stateLock.unlock();
        saveConversation();
    }
    else
    {
        conversationId = conversationsResponse[0].id;
        std::unique_lock<std::shared_mutex> stateLock(stateMutex);
        conversationManager.loadConversation(conversationId, nodeMap, rootNodeId, currentNodeId);
    }
}

ConversationNode *AI::findNode(const std::string &nodeId)
{
    if (nodeId.empty())
        return nullptr;
    auto it = nodeMap.find(nodeId);
    return (it != nodeMap.end()) ? it->second.get() : nullptr;
}

std::vector<ConversationNode> AI::getPathFromRoot(const std::string &nodeId)
{
    std::vector<ConversationNode> path;
    std::string currentId = nodeId;
    while (!currentId.empty())
    {
        ConversationNode *node = findNode(currentId);
        if (!node)
            break;
        path.push_back(*node);
        currentId = node->parentId;
    }
    std::reverse(path.begin(), path.end());
    return path;
}

void AI::addNode(ConversationNode::ROLE role, std::string content)
{
    if (content.empty() && role != ConversationNode::ROLE_SYSTEM)
        return;

    std::unique_lock<std::shared_mutex> stateLock(stateMutex);
    std::string nodeId = strUtils::randomId();
    ConversationNode *parent = findNode(currentNodeId);
    if (parent)
        parent->childIds.push_back(nodeId);
    nodeMap[nodeId] = std::make_unique<ConversationNode>(nodeId, role, content, currentNodeId);
    currentNodeId = nodeId;
    stateLock.unlock();
    saveConversation();
}

bool AI::deleteNode(const std::string &nodeId)
{
    if (nodeId.empty() || nodeId == rootNodeId)
        return false;

    std::unique_lock<std::shared_mutex> stateLock(stateMutex);
    ConversationNode *node = findNode(nodeId);
    if (!node)
        return false;

    ConversationNode *parent = findNode(node->parentId);
    if (parent)
    {
        auto it = std::find(parent->childIds.begin(), parent->childIds.end(), nodeId);
        if (it != parent->childIds.end())
            parent->childIds.erase(it);
    }

    nodeMap.erase(nodeId);
    if (currentNodeId == nodeId)
        currentNodeId = node->parentId;
    stateLock.unlock();
    saveConversation();
    return true;
}

bool AI::switchNode(const std::string &nodeId)
{
    if (nodeId.empty())
        return false;

    std::unique_lock<std::shared_mutex> stateLock(stateMutex);
    ConversationNode *node = findNode(nodeId);
    if (node)
    {
        currentNodeId = nodeId;
        return true;
    }
    return false;
}

std::vector<std::string> AI::getChildren(const std::string &nodeId)
{
    if (nodeId.empty())
        return {};

    std::shared_lock<std::shared_mutex> stateLock(stateMutex);
    ConversationNode *node = findNode(nodeId);
    if (node)
        return node->childIds;
    return {};
}

std::vector<ConversationNode> AI::getCurrentPath()
{
    std::shared_lock<std::shared_mutex> stateLock(stateMutex);
    return getPathFromRoot(currentNodeId);
}
std::string AI::getCurrentNodeId() const
{
    std::shared_lock<std::shared_mutex> stateLock(stateMutex);
    return currentNodeId;
}
std::string AI::getRootNodeId() const
{
    std::shared_lock<std::shared_mutex> stateLock(stateMutex);
    return rootNodeId;
}
std::string AI::getConversationId() const
{
    std::shared_lock<std::shared_mutex> stateLock(stateMutex);
    return conversationId;
}

void AI::saveConversation()
{
    std::shared_lock<std::shared_mutex> stateLock(stateMutex);
    if (!conversationId.empty())
    {
        conversationManager.saveConversation(conversationId, nodeMap);
    }
}

std::vector<ConversationInfo> AI::getConversationList()
{
    std::lock_guard<std::mutex> conversationLock(conversationMutex);
    return conversationManager.getConversationList();
}

void AI::createConversation(const std::string &title)
{
    if (title.empty())
        return;

    std::lock_guard<std::mutex> conversationLock(conversationMutex);
    std::string newConversationId;
    conversationManager.createConversation(title, newConversationId);

    {
        std::unique_lock<std::shared_mutex> stateLock(stateMutex);
        conversationId = newConversationId;
        nodeMap.clear();

        std::lock_guard<std::mutex> settingsLock(settingsMutex);
        currentNodeId = rootNodeId = strUtils::randomId();
        nodeMap[currentNodeId] = std::make_unique<ConversationNode>(
            currentNodeId, ConversationNode::ROLE_SYSTEM, systemPrompt, "");
    }
    saveConversation();
}

void AI::loadConversation(const std::string &conversationId)
{
    if (conversationId.empty())
        return;

    std::lock_guard<std::mutex> conversationLock(conversationMutex);
    std::unique_lock<std::shared_mutex> stateLock(stateMutex);
    this->conversationId = conversationId;
    conversationManager.loadConversation(conversationId, nodeMap, rootNodeId, currentNodeId);
}

void AI::deleteConversation(const std::string &conversationId)
{
    if (conversationId.empty())
        return;

    std::unique_lock<std::mutex> conversationLock(conversationMutex);
    conversationManager.deleteConversation(conversationId);

    std::unique_lock<std::shared_mutex> stateLock(stateMutex);
    if (this->conversationId == conversationId)
    {
        auto conversations = conversationManager.getConversationList();
        if (!conversations.empty())
        {
            this->conversationId = conversations[0].id;
            conversationManager.loadConversation(this->conversationId, nodeMap, rootNodeId, currentNodeId);
        }
        else
        {
            this->conversationId.clear();
            nodeMap.clear();
            conversationLock.unlock();
            stateLock.unlock();
            createConversation("默认对话");
        }
    }
}

void AI::updateConversationTitle(const std::string &conversationId, const std::string &title)
{
    std::lock_guard<std::mutex> conversationLock(conversationMutex);
    conversationManager.updateConversationTitle(conversationId, title);
}

void AI::setSettings(const std::string &apiKey, const std::string &baseUrl,
                     const std::string &model, int maxTokens,
                     double temperature, double topP, std::string systemPrompt)
{
    std::lock_guard<std::mutex> settingsLock(settingsMutex);
    this->apiKey = apiKey, this->baseUrl = baseUrl;
    this->model = model, this->maxTokens = maxTokens;
    this->temperature = temperature, this->topP = topP, this->systemPrompt = systemPrompt;
    conversationManager.saveApiSettings(apiKey, baseUrl, model, maxTokens, temperature, topP, systemPrompt);
}
SettingsResponse AI::getSettings() const
{
    std::lock_guard<std::mutex> settingsLock(settingsMutex);
    return SettingsResponse(apiKey, baseUrl,
                            model, maxTokens,
                            temperature, topP, systemPrompt);
}

std::string AI::generateResponse(AIStreamCallback streamCallback)
{
    nlohmann::json requestJson;
    {
        std::lock_guard<std::mutex> settingsLock(settingsMutex);
        requestJson["model"] = model;
        requestJson["max_tokens"] = maxTokens;
        requestJson["temperature"] = temperature;
        requestJson["top_p"] = topP;
    }

    requestJson["stream"] = true;

    const std::string_view roleString[3] = {"user", "assistant", "system"};
    nlohmann::json messagesArray = nlohmann::json::array();

    {
        std::shared_lock<std::shared_mutex> stateLock(stateMutex);
        for (const auto &msg : getPathFromRoot(currentNodeId))
            messagesArray.push_back({{"role", roleString[msg.role]},
                                     {"content", msg.content}});
    }

    requestJson["messages"] = messagesArray;

    std::string fullAssistantResponse;
    std::mutex responseMutex;
    bool wasCancelled = false;
    bool responseStarted = false;
    std::string assistantNodeId;
    ConversationNode::STOP_REASON finalStopReason = ConversationNode::STOP_REASON_NONE;

    std::shared_ptr<std::atomic<bool>> cancellationToken;
    {
        std::lock_guard<std::mutex> cancelLock(requestCancelMutex);
        currentRequestCancelled = std::make_shared<std::atomic<bool>>(false);
        cancellationToken = currentRequestCancelled;
    }

    StreamCallback packedStreamCallback = [&fullAssistantResponse, &responseMutex, &wasCancelled, &responseStarted, &assistantNodeId, &finalStopReason, cancellationToken, streamCallback, this](const std::string &chunk)
    {
        if (cancellationToken->load())
        {
            wasCancelled = true;
            finalStopReason = ConversationNode::STOP_REASON_USER_STOPPED;
            return;
        }

        if (chunk.empty() || chunk == "[DONE]")
            return;

        nlohmann::json chunkJson = nlohmann::json::parse(chunk);
        auto choice = chunkJson["choices"][0];

        if (choice["finish_reason"].is_string())
        {
            std::string finishReason = choice["finish_reason"];
            if (finishReason == "stop")
                finalStopReason = ConversationNode::STOP_REASON_STOP;
            else if (finishReason == "length")
                finalStopReason = ConversationNode::STOP_REASON_LENGTH;
            else if (finishReason == "content_filter")
                finalStopReason = ConversationNode::STOP_REASON_CONTENT_FILTER;
            else
                finalStopReason = ConversationNode::STOP_REASON_ERROR;
        }

        std::string content = "";
        if (choice["delta"]["reasoning_content"].is_string())
            content += choice["delta"]["reasoning_content"];
        if (choice["delta"]["content"].is_string())
            content += choice["delta"]["content"];
        if (content != "")
        {
            {
                std::lock_guard<std::mutex> lock(responseMutex);
                fullAssistantResponse += content;

                if (!responseStarted && !content.empty())
                {
                    responseStarted = true;
                    std::unique_lock<std::shared_mutex> stateLock(stateMutex);
                    assistantNodeId = strUtils::randomId();
                    ConversationNode *parent = findNode(currentNodeId);
                    if (parent)
                        parent->childIds.push_back(assistantNodeId);
                    nodeMap[assistantNodeId] = std::make_unique<ConversationNode>(assistantNodeId, ConversationNode::ROLE_ASSISTANT, fullAssistantResponse, currentNodeId);
                    currentNodeId = assistantNodeId;
                    stateLock.unlock();
                    saveConversation();
                }
                else if (responseStarted && !assistantNodeId.empty())
                {
                    std::unique_lock<std::shared_mutex> stateLock(stateMutex);
                    ConversationNode *assistantNode = findNode(assistantNodeId);
                    if (assistantNode)
                        assistantNode->content = fullAssistantResponse;
                    stateLock.unlock();
                    saveConversation();
                }
            }
            streamCallback(content);
        }
    };

    std::string currentApiKey, currentBaseUrl;
    {
        std::lock_guard<std::mutex> settingsLock(settingsMutex);
        currentApiKey = apiKey;
        currentBaseUrl = baseUrl;
    }

    Response response = Fetch::fetch(currentBaseUrl + "chat/completions",
                                     FetchOptions("POST",
                                                  {{"Content-Type", "application/json"},
                                                   {"Authorization", "Bearer " + currentApiKey},
                                                   {"Accept", "text/event-stream"}},
                                                  requestJson.dump(),
                                                  true,
                                                  packedStreamCallback,
                                                  0,
                                                  cancellationToken));
    {
        std::lock_guard<std::mutex> cancelLock(requestCancelMutex);
        currentRequestCancelled = nullptr;
    }
    if (wasCancelled || cancellationToken->load())
    {
        std::lock_guard<std::mutex> lock(responseMutex);
        if (responseStarted && !assistantNodeId.empty())
        {
            std::unique_lock<std::shared_mutex> stateLock(stateMutex);
            ConversationNode *assistantNode = findNode(assistantNodeId);
            if (assistantNode)
            {
                assistantNode->stopReason = ConversationNode::STOP_REASON_USER_STOPPED;
            }
            stateLock.unlock();
            saveConversation();
        }
        return fullAssistantResponse;
    }
    if (!response.isOk())
        THROW_NETWORK_ERROR(response.status);

    {
        std::lock_guard<std::mutex> lock(responseMutex);
        if (!responseStarted && !fullAssistantResponse.empty())
        {
            addNode(ConversationNode::ROLE_ASSISTANT, fullAssistantResponse);
        }
        else if (responseStarted && !assistantNodeId.empty() && finalStopReason != ConversationNode::STOP_REASON_NONE)
        {
            std::unique_lock<std::shared_mutex> stateLock(stateMutex);
            ConversationNode *assistantNode = findNode(assistantNodeId);
            if (assistantNode)
            {
                assistantNode->stopReason = finalStopReason;
            }
            stateLock.unlock();
            saveConversation();
        }
        return fullAssistantResponse;
    }
}

void AI::stopGeneration()
{
    std::lock_guard<std::mutex> cancelLock(requestCancelMutex);
    if (currentRequestCancelled)
        currentRequestCancelled->store(true);
}

std::vector<std::string> AI::getModels()
{
    std::string currentApiKey, currentBaseUrl;
    {
        std::lock_guard<std::mutex> settingsLock(settingsMutex);
        currentApiKey = apiKey;
        currentBaseUrl = baseUrl;
    }

    if (currentApiKey.empty() || currentBaseUrl.empty())
        THROW_EXCEPTION("API key or base URL not configured");

    std::vector<std::string> modelIds;
    Response response = Fetch::fetch(currentBaseUrl + "models",
                                     FetchOptions("GET",
                                                  {{"Authorization", "Bearer " + currentApiKey}}));
    if (!response.isOk())
        THROW_NETWORK_ERROR(response.status);
    nlohmann::json responseJson = response.json();
    if (responseJson.contains("data") && responseJson["data"].is_array())
    {
        for (const auto &model : responseJson.at("data"))
        {
            if (model.contains("id") && model["id"].is_string())
                modelIds.push_back(model.at("id"));
        }
    }
    return modelIds;
}

float AI::getUserBalance()
{
    std::string currentApiKey, currentBaseUrl;
    {
        std::lock_guard<std::mutex> settingsLock(settingsMutex);
        currentApiKey = apiKey;
        currentBaseUrl = baseUrl;
    }

    if (currentApiKey.empty() || currentBaseUrl.empty())
        THROW_EXCEPTION("API key or base URL not configured");

    Response response = Fetch::fetch(currentBaseUrl + "user/balance",
                                     FetchOptions("GET",
                                                  {{"Authorization", "Bearer " + currentApiKey}}));
    if (!response.isOk())
        THROW_NETWORK_ERROR(response.status);
    nlohmann::json responseJson = response.json();
    if (responseJson.contains("balance_infos") && responseJson["balance_infos"].is_array())
    {
        for (const auto &balanceInfo : responseJson.at("balance_infos"))
        {
            if (balanceInfo.contains("currency") && balanceInfo["currency"].is_string() &&
                balanceInfo.at("currency") == "CNY" &&
                balanceInfo.contains("total_balance"))
            {
                return std::atof(std::string(balanceInfo.at("total_balance")).c_str());
            }
        }
    }
    return 0.0f;
}
