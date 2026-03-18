# Qt Bridge Implementation Status

Date: 2026-03-18
Project: USAN Desktop
Scope: Replacement path for the previously planned Squish-based Qt automation route, including runtime validation fixtures

## 1. Summary

An in-house Qt automation bridge has been implemented for the desktop app and validated against controlled runtime fixtures. The current direction is to route Qt targets through a native `qt-bridge` instead of depending on Squish as a product runtime dependency.

The implementation covers:

- Qt target detection in the desktop main process
- provider routing for Qt processes
- a named-pipe JSON-RPC bridge between Electron and injected native code
- a Windows injector executable
- a Qt DLL bridge for object tree inspection, property access, method invocation, and screenshots across widgets and Quick targets
- AI tool exposure for bridge operations
- automated runtime validation fixtures for QWidget and QQuickWindow flows

The implementation is buildable, integrated, and runtime-validated on local fixtures. It is now ready for broader validation against Qt example applications and real production targets.

## 2. Implemented Architecture

The current stack is split into three layers:

1. Electron main process
   - Detects the target application framework
   - Routes Qt processes to the Qt bridge provider
   - Exposes bridge capabilities as internal AI tools

2. Native injector
   - Attaches to a Qt target process
   - Loads the bridge DLL
   - Enforces basic architecture compatibility checks

3. Injected Qt bridge DLL
   - Hosts a named-pipe server inside the target process
   - Enumerates Qt object trees
   - Resolves objects by query
   - Reads and writes Qt properties
   - Invokes Qt methods with runtime type conversion
   - Captures `QWidget`, `QQuickWindow`, and `QQuickItem` screenshots

## 3. Files Added Or Updated

### Desktop integration

- `apps/desktop/src/main/mcp/app-detector.ts`
- `apps/desktop/src/main/mcp/router.ts`
- `apps/desktop/src/main/mcp/providers/qt-bridge.ts`
- `apps/desktop/src/main/ai/tools/qt-bridge-tools.ts`
- `apps/desktop/src/main/ai/tools/index.ts`
- `apps/desktop/src/main/ai/tool-catalog.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/package.json`
- `apps/desktop/.gitignore`

### Native bridge

- `apps/desktop/native/qt-bridge/CMakeLists.txt`
- `apps/desktop/native/qt-bridge/README.md`
- `apps/desktop/native/qt-bridge/scripts/build.ps1`
- `apps/desktop/native/qt-bridge/scripts/validate.ps1`
- `apps/desktop/native/qt-bridge/src/qt_injector.cpp`
- `apps/desktop/native/qt-bridge/src/qt_bridge_dll.cpp`
- `apps/desktop/native/qt-bridge/fixtures/widgets-fixture/main.cpp`
- `apps/desktop/native/qt-bridge/fixtures/quick-fixture/main.cpp`

### Validation

- `apps/desktop/tests/unit/app-detector.test.ts`

## 4. Functional Coverage

The current bridge path supports the following flows:

- list candidate application targets
- detect whether a process should route to Qt, browser/CDP, or Windows automation
- connect to a Qt target through the injector
- retrieve a Qt object tree
- find an object by query
- read a property
- write a property
- invoke a Qt method
- capture a basic Qt widget screenshot
- capture Quick window and item screenshots
- run automated runtime validation against controlled Qt fixtures

## 5. Technical Notes

Several correctness and reliability issues were reviewed and improved during implementation:

- property reads and writes now use Qt meta-property information instead of relying only on dynamic properties
- method invocation now searches inherited methods and supports overload selection by name, arity, and type conversion
- method invocation was expanded beyond the initial two-argument limit
- the injector now rejects incompatible target process architecture combinations earlier
- Electron processes are explicitly routed to the browser tooling path instead of falling through to generic Windows automation
- missing AI tool exposure for object lookup and screenshots was added
- request-level performance instrumentation was added across the Electron provider and native DLL bridge

## 6. Performance Instrumentation

The bridge now emits timing and size-oriented observability data so runtime bottlenecks can be measured before attempting low-level optimization.

Current instrumentation includes:

- total request duration on the Electron side
- native handler duration returned as response metadata
- calculated bridge overhead between provider-side duration and native execution time
- request and response payload sizes
- method-specific metadata such as tree node count, match count, overload count, and screenshot byte size
- timeout and slow-request warning logs on the Electron side

## 7. Validation Status

The following checks have already passed in the project:

- `npm run typecheck:node`
- `npx vitest run tests/unit/app-detector.test.ts`
- `npm run build:qt-bridge`
- `npm run validate:qt-bridge` or `powershell -NoProfile -ExecutionPolicy Bypass -File native/qt-bridge/scripts/validate.ps1`

Native build output has been confirmed at:

- `apps/desktop/native/qt-bridge/build/qt-injector.exe`
- `apps/desktop/native/qt-bridge/build/ubridge-qt.dll`
- `apps/desktop/native/qt-bridge/build/qt-fixture-widgets.exe`
- `apps/desktop/native/qt-bridge/build/qt-fixture-quick.exe`

Validated runtime flows:

- widget fixture: `getObjectTree`, `findObject`, `getProperty`, `setProperty`, `invokeMethod`, `screenshot`
- quick fixture: `getObjectTree`, `findObject`, `getProperty`, `setProperty`, `invokeMethod`, `screenshot`

Observed validation result on 2026-03-18:

- widget fixture screenshot payload: 3127 bytes
- quick fixture screenshot payload: 4818 bytes

## 8. Known Gaps

The core bridge is validated on local fixtures, but the remaining gaps are:

- no end-to-end runtime validation on Qt example applications or production targets yet
- QML-engine-specific validation through `QQmlApplicationEngine` root objects is not covered by the current Quick fixture
- bridge startup still relies on DLL initialization behavior that should be hardened further
- reconnect, shutdown, and failure recovery paths need more runtime testing
- security and packaging hardening are still pending

## 9. Recommended Next Steps

The next execution phase should focus on broader target coverage rather than new feature surface area.

Recommended order:

1. Validate the injector and pipe connection against Qt example applications under `C:\Qt\Examples\Qt-6.10.2`
2. Compare object discovery and interaction results against Squish on the same sample applications
3. Add repeated attach and detach cycle coverage to the validation script
4. Add a dedicated `QQmlApplicationEngine` fixture if QML-root enumeration needs stricter regression coverage
5. Harden startup, shutdown, and failure recovery before enabling production-facing workflows

## 10. Status Statement

Current status: implemented, integrated, buildable, and runtime-validated on QWidget and Quick fixtures; ready for validation on Qt example apps and real targets.
