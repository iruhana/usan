#include <Windows.h>
#include <TlHelp32.h>
#include <shellapi.h>

#include <algorithm>
#include <cwctype>
#include <filesystem>
#include <iostream>
#include <string>
#include <string_view>

namespace {

bool IsTargetArchitectureSupported(HANDLE process, std::wstring* errorMessage) {
#if defined(_WIN64)
  using IsWow64Process2Fn = BOOL(WINAPI*)(HANDLE, USHORT*, USHORT*);
  const auto fn = reinterpret_cast<IsWow64Process2Fn>(
    GetProcAddress(GetModuleHandleW(L"kernel32.dll"), "IsWow64Process2")
  );

  if (fn) {
    USHORT processMachine = IMAGE_FILE_MACHINE_UNKNOWN;
    USHORT nativeMachine = IMAGE_FILE_MACHINE_UNKNOWN;
    if (fn(process, &processMachine, &nativeMachine) && processMachine != IMAGE_FILE_MACHINE_UNKNOWN) {
      if (errorMessage) {
        *errorMessage = L"32-bit target processes are not supported by the x64 injector.";
      }
      return false;
    }
    return true;
  }

  BOOL isWow64 = FALSE;
  if (IsWow64Process(process, &isWow64) && isWow64) {
    if (errorMessage) {
      *errorMessage = L"32-bit target processes are not supported by the x64 injector.";
    }
    return false;
  }
#endif

  return true;
}

std::wstring GetArgValue(int argc, wchar_t* argv[], const std::wstring& name) {
  for (int i = 1; i < argc - 1; ++i) {
    if (name == argv[i]) {
      return argv[i + 1];
    }
  }
  return L"";
}

std::filesystem::path ResolveDllPath(int argc, wchar_t* argv[]) {
  const auto explicitDll = GetArgValue(argc, argv, L"--dll");
  if (!explicitDll.empty()) {
    return std::filesystem::path(explicitDll);
  }

  wchar_t modulePath[MAX_PATH] = {};
  GetModuleFileNameW(nullptr, modulePath, MAX_PATH);
  auto path = std::filesystem::path(modulePath).parent_path();
  return path / L"ubridge-qt.dll";
}

std::wstring NormalizeModuleName(const std::filesystem::path& path) {
  std::wstring name = path.filename().wstring();
  std::transform(name.begin(), name.end(), name.begin(), [](wchar_t ch) {
    return static_cast<wchar_t>(std::towlower(ch));
  });
  return name;
}

HMODULE FindRemoteModule(DWORD pid, const std::filesystem::path& dllPath) {
  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pid);
  if (snapshot == INVALID_HANDLE_VALUE) {
    return nullptr;
  }

  MODULEENTRY32W entry{};
  entry.dwSize = sizeof(entry);
  const std::wstring expectedName = NormalizeModuleName(dllPath);

  if (!Module32FirstW(snapshot, &entry)) {
    CloseHandle(snapshot);
    return nullptr;
  }

  do {
    std::wstring currentName = entry.szModule;
    std::transform(currentName.begin(), currentName.end(), currentName.begin(), [](wchar_t ch) {
      return static_cast<wchar_t>(std::towlower(ch));
    });

    if (currentName == expectedName) {
      CloseHandle(snapshot);
      return entry.hModule;
    }
  } while (Module32NextW(snapshot, &entry));

  CloseHandle(snapshot);
  return nullptr;
}

uintptr_t ResolveRemoteExportAddress(const std::filesystem::path& dllPath, HMODULE remoteModule, const char* exportName) {
  HMODULE localModule = LoadLibraryExW(dllPath.c_str(), nullptr, DONT_RESOLVE_DLL_REFERENCES);
  if (!localModule) {
    std::wcerr << L"LoadLibraryExW failed for export resolution: " << GetLastError() << std::endl;
    return 0;
  }

  FARPROC localExport = GetProcAddress(localModule, exportName);
  if (!localExport) {
    std::wcerr << L"GetProcAddress failed for export " << exportName << L": " << GetLastError() << std::endl;
    FreeLibrary(localModule);
    return 0;
  }

  const uintptr_t offset =
    reinterpret_cast<uintptr_t>(localExport) - reinterpret_cast<uintptr_t>(localModule);
  FreeLibrary(localModule);
  return reinterpret_cast<uintptr_t>(remoteModule) + offset;
}

bool WaitForRemoteThread(HANDLE thread, DWORD timeoutMs, std::wstring_view actionLabel, DWORD* exitCode) {
  const DWORD waitResult = WaitForSingleObject(thread, timeoutMs);
  if (waitResult == WAIT_TIMEOUT) {
    std::wcerr << actionLabel << L" timed out." << std::endl;
    return false;
  }

  if (waitResult == WAIT_FAILED) {
    std::wcerr << actionLabel << L" wait failed: " << GetLastError() << std::endl;
    return false;
  }

  DWORD localExitCode = 0;
  if (!GetExitCodeThread(thread, &localExitCode)) {
    std::wcerr << actionLabel << L" exit code lookup failed: " << GetLastError() << std::endl;
    return false;
  }

  if (exitCode) {
    *exitCode = localExitCode;
  }
  return true;
}

bool InjectLibrary(DWORD pid, const std::filesystem::path& dllPath) {
  HANDLE process = OpenProcess(
    PROCESS_CREATE_THREAD | PROCESS_QUERY_INFORMATION | PROCESS_VM_OPERATION |
      PROCESS_VM_WRITE | PROCESS_VM_READ,
    FALSE,
    pid
  );

  if (!process) {
    std::wcerr << L"OpenProcess failed for PID " << pid << L": " << GetLastError() << std::endl;
    return false;
  }

  std::wstring architectureError;
  if (!IsTargetArchitectureSupported(process, &architectureError)) {
    std::wcerr << architectureError << std::endl;
    CloseHandle(process);
    return false;
  }

  const std::wstring dll = dllPath.wstring();
  const SIZE_T bytes = (dll.size() + 1) * sizeof(wchar_t);
  LPVOID remoteBuffer = VirtualAllocEx(process, nullptr, bytes, MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE);
  if (!remoteBuffer) {
    std::wcerr << L"VirtualAllocEx failed: " << GetLastError() << std::endl;
    CloseHandle(process);
    return false;
  }

  if (!WriteProcessMemory(process, remoteBuffer, dll.c_str(), bytes, nullptr)) {
    std::wcerr << L"WriteProcessMemory failed: " << GetLastError() << std::endl;
    VirtualFreeEx(process, remoteBuffer, 0, MEM_RELEASE);
    CloseHandle(process);
    return false;
  }

  auto* loadLibrary = reinterpret_cast<LPTHREAD_START_ROUTINE>(
    GetProcAddress(GetModuleHandleW(L"kernel32.dll"), "LoadLibraryW")
  );

  if (!loadLibrary) {
    std::wcerr << L"LoadLibraryW address lookup failed." << std::endl;
    VirtualFreeEx(process, remoteBuffer, 0, MEM_RELEASE);
    CloseHandle(process);
    return false;
  }

  HANDLE thread = CreateRemoteThread(process, nullptr, 0, loadLibrary, remoteBuffer, 0, nullptr);
  if (!thread) {
    std::wcerr << L"CreateRemoteThread failed: " << GetLastError() << std::endl;
    VirtualFreeEx(process, remoteBuffer, 0, MEM_RELEASE);
    CloseHandle(process);
    return false;
  }

  DWORD exitCode = 0;
  const bool loadCompleted = WaitForRemoteThread(thread, 15000, L"Remote LoadLibraryW", &exitCode);

  CloseHandle(thread);
  VirtualFreeEx(process, remoteBuffer, 0, MEM_RELEASE);

  if (!loadCompleted) {
    CloseHandle(process);
    return false;
  }

  if (exitCode == 0) {
    std::wcerr << L"Remote LoadLibraryW returned 0." << std::endl;
    CloseHandle(process);
    return false;
  }

  HMODULE remoteModule = FindRemoteModule(pid, dllPath);
  if (!remoteModule) {
    std::wcerr << L"Unable to locate injected module in target process." << std::endl;
    CloseHandle(process);
    return false;
  }

  const uintptr_t remoteStartAddress = ResolveRemoteExportAddress(dllPath, remoteModule, "UbridgeQtStart");
  if (!remoteStartAddress) {
    CloseHandle(process);
    return false;
  }

  HANDLE startThread = CreateRemoteThread(
    process,
    nullptr,
    0,
    reinterpret_cast<LPTHREAD_START_ROUTINE>(remoteStartAddress),
    nullptr,
    0,
    nullptr
  );
  if (!startThread) {
    std::wcerr << L"CreateRemoteThread failed for UbridgeQtStart: " << GetLastError() << std::endl;
    CloseHandle(process);
    return false;
  }

  DWORD startExitCode = 0;
  const bool startCompleted = WaitForRemoteThread(startThread, 15000, L"Remote UbridgeQtStart", &startExitCode);
  CloseHandle(startThread);
  CloseHandle(process);

  if (!startCompleted) {
    return false;
  }

  if (startExitCode != 0) {
    std::wcerr << L"Remote UbridgeQtStart returned " << startExitCode << L"." << std::endl;
    return false;
  }

  return true;
}

}  // namespace

int main() {
  int argc = 0;
  wchar_t** argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  if (!argv) {
    std::wcerr << L"CommandLineToArgvW failed." << std::endl;
    return 1;
  }

  if (argc < 2) {
    std::wcerr << L"Usage: qt-injector inject --pid <PID> [--dll <path-to-ubridge-qt.dll>]" << std::endl;
    LocalFree(argv);
    return 1;
  }

  const std::wstring command = argv[1];
  if (command != L"inject") {
    std::wcerr << L"Unsupported command: " << command << std::endl;
    LocalFree(argv);
    return 1;
  }

  const auto pidArg = GetArgValue(argc, argv, L"--pid");
  if (pidArg.empty()) {
    std::wcerr << L"--pid is required." << std::endl;
    LocalFree(argv);
    return 1;
  }

  DWORD pid = static_cast<DWORD>(std::stoul(pidArg));
  const auto dllPath = ResolveDllPath(argc, argv);
  if (!std::filesystem::exists(dllPath)) {
    std::wcerr << L"ubridge-qt.dll not found: " << dllPath.wstring() << std::endl;
    LocalFree(argv);
    return 1;
  }

  if (!InjectLibrary(pid, dllPath)) {
    LocalFree(argv);
    return 1;
  }

  std::wcout << L"Injected into PID " << pid << L": " << dllPath.wstring() << std::endl;
  LocalFree(argv);
  return 0;
}
