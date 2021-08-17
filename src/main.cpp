#include <iostream>
#include <jsoncpp/json/value.h>
#include <jsoncpp/json/json.h>
#include <fstream>
#include <string>

int main() {
    std::ifstream file("./temp/failure.json");
    Json::Value actualJson;
    Json::Reader reader;

    reader.parse(file, actualJson);

    std::cout << sizeof(actualJson) << std::endl;
    // std::cout << actualJson << std::endl;

    std::cout << "itemid: " << actualJson["buyBodyLong"]["shipping_orders"][0]["selected_logistic_channelid"] << std::endl;

    return 0;
}