# UBridge-Qt

Clean-room Qt automation bridge for Usan desktop.

## Output

- `qt-injector.exe`: injects `ubridge-qt.dll` into a target Qt process
- `ubridge-qt.dll`: hosts a named-pipe JSON-RPC server inside the target process
- `qt-fixture-widgets.exe`: QWidget validation fixture
- `qt-fixture-quick.exe`: QQuickWindow validation fixture

## Build

```powershell
npm run build:qt-bridge
```

Default build assumptions:

- Qt: `C:\Qt\6.10.2\mingw_64`
- Generator: `MinGW Makefiles`
- Architecture: x64

## Validate

```powershell
npm run validate:qt-bridge
```

The validation script builds the bridge, launches both fixture applications, injects the bridge DLL, and verifies these JSON-RPC flows end to end:

- `getObjectTree`
- `findObject`
- `getProperty`
- `setProperty`
- `invokeMethod`
- `screenshot`

The widgets fixture validates the `QWidget` path. The quick fixture validates `QQuickWindow` capture and Quick object discovery without relying on Squish.

## Current Scope

- DLL injection via `CreateRemoteThread` + `LoadLibraryW`
- Named pipe server at `\\.\pipe\ubridge-qt-{PID}`
- JSON-RPC methods:
  - `getObjectTree`
  - `findObject`
  - `getProperty`
  - `setProperty`
  - `invokeMethod`
  - `screenshot`
- root enumeration across `QApplication`, `QGuiApplication`, and `QQmlApplicationEngine`
- screenshot capture for `QWidget`, `QQuickWindow`, and `QQuickItem`

## Notes

- This is intended as the long-term replacement for Squish in the Usan automation stack.
- `scripts/validate.ps1` is the baseline runtime regression check before targeting real Qt applications.
- Additional validation against Qt example apps under `C:\Qt\Examples\Qt-6.10.2` and production targets is still recommended.
