cmake_minimum_required(VERSION 3.21)
project(ubridge_qt LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 REQUIRED COMPONENTS Core Gui Widgets)
find_package(Qt6 COMPONENTS Qml Quick QUIET)

add_library(ubridge-qt SHARED
  src/qt_bridge_dll.cpp
)

target_compile_definitions(ubridge-qt PRIVATE
  UNICODE
  _UNICODE
  WIN32_LEAN_AND_MEAN
  NOMINMAX
)

target_link_libraries(ubridge-qt PRIVATE
  Qt6::Core
  Qt6::Gui
  Qt6::Widgets
)

set_target_properties(ubridge-qt PROPERTIES
  PREFIX ""
  OUTPUT_NAME "ubridge-qt"
)

if(TARGET Qt6::Qml)
  target_link_libraries(ubridge-qt PRIVATE Qt6::Qml Qt6::Quick)
  target_compile_definitions(ubridge-qt PRIVATE UBRIDGE_QT_HAS_QML=1)
endif()

add_executable(qt-injector
  src/qt_injector.cpp
)

target_compile_definitions(qt-injector PRIVATE
  UNICODE
  _UNICODE
  WIN32_LEAN_AND_MEAN
  NOMINMAX
)

add_executable(qt-fixture-widgets
  fixtures/widgets-fixture/main.cpp
)

target_link_libraries(qt-fixture-widgets PRIVATE
  Qt6::Core
  Qt6::Gui
  Qt6::Widgets
)

set_target_properties(qt-fixture-widgets PROPERTIES
  WIN32_EXECUTABLE TRUE
)

if(TARGET Qt6::Qml)
  add_executable(qt-fixture-quick
    fixtures/quick-fixture/main.cpp
  )

  target_link_libraries(qt-fixture-quick PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Qml
    Qt6::Quick
  )

  set_target_properties(qt-fixture-quick PROPERTIES
    WIN32_EXECUTABLE TRUE
  )
endif()
