# Ponte entre o Java e o Node (nodejs-mobile). O libnode.so e os cabecalhos
# sao baixados pelo workflow para app/libnode/ (scripts/preparar-android.sh).
cmake_minimum_required(VERSION 3.10.2)
project(asaedit)

set(LIBNODE ${CMAKE_SOURCE_DIR}/../../../libnode)

add_library(native-lib SHARED native-lib.cpp)
include_directories(${LIBNODE}/include/node)

add_library(libnode SHARED IMPORTED)
set_target_properties(libnode PROPERTIES IMPORTED_LOCATION ${LIBNODE}/bin/${ANDROID_ABI}/libnode.so)

find_library(log-lib log)
target_link_libraries(native-lib libnode ${log-lib})
