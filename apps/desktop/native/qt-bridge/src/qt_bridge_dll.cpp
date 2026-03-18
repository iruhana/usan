#include <Windows.h>

#include <atomic>
#include <algorithm>
#include <chrono>
#include <cmath>
#include <functional>
#include <optional>
#include <string>
#include <vector>

#include <QApplication>
#include <QBuffer>
#include <QByteArray>
#include <QGuiApplication>
#include <QImage>
#include <QCoreApplication>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonValue>
#include <QMetaMethod>
#include <QMetaObject>
#include <QMetaProperty>
#include <QPixmap>
#include <QRect>
#include <QStringList>
#include <QThread>
#include <QVariant>
#include <QWindow>
#include <QWidget>

#ifdef UBRIDGE_QT_HAS_QML
#include <QQmlApplicationEngine>
#include <QQuickItem>
#include <QQuickWindow>
#endif

namespace {

std::atomic<bool> g_running{false};
std::atomic<bool> g_started{false};
using Clock = std::chrono::steady_clock;

std::wstring PipeNameForCurrentProcess() {
  return L"\\\\.\\pipe\\ubridge-qt-" + std::to_wstring(GetCurrentProcessId());
}

double RoundDurationMs(double durationMs) {
  return std::round(durationMs * 100.0) / 100.0;
}

double ElapsedMs(const Clock::time_point& startedAt) {
  return RoundDurationMs(std::chrono::duration<double, std::milli>(Clock::now() - startedAt).count());
}

template <typename Func>
bool RunOnQtThread(Func func) {
  auto* coreApp = QCoreApplication::instance();
  if (!coreApp) {
    return false;
  }

  if (QThread::currentThread() == coreApp->thread()) {
    func();
    return true;
  }

  return QMetaObject::invokeMethod(coreApp, func, Qt::BlockingQueuedConnection);
}

QJsonValue VariantToJson(const QVariant& value) {
  if (!value.isValid() || value.isNull()) {
    return QJsonValue();
  }

  switch (value.typeId()) {
    case QMetaType::Bool:
      return QJsonValue(value.toBool());
    case QMetaType::Int:
    case QMetaType::UInt:
    case QMetaType::LongLong:
    case QMetaType::ULongLong:
      return QJsonValue(static_cast<qint64>(value.toLongLong()));
    case QMetaType::Double:
    case QMetaType::Float:
      return QJsonValue(value.toDouble());
    case QMetaType::QString:
      return QJsonValue(value.toString());
    case QMetaType::QStringList: {
      QJsonArray array;
      for (const auto& item : value.toStringList()) {
        array.append(item);
      }
      return array;
    }
    case QMetaType::QRect: {
      const auto rect = value.toRect();
      return QJsonObject{
        {"x", rect.x()},
        {"y", rect.y()},
        {"w", rect.width()},
        {"h", rect.height()},
      };
    }
    default:
      break;
  }

  return QJsonValue(value.toString());
}

QString PathSegmentForObject(QObject* object) {
  if (!object) {
    return QString();
  }

  if (!object->objectName().isEmpty()) {
    return object->objectName();
  }

  const QString className = object->metaObject()->className();
  auto* parent = object->parent();
  if (!parent) {
    return className;
  }

  int index = 0;
  for (QObject* sibling : parent->children()) {
    if (QString(sibling->metaObject()->className()) == className && sibling->objectName().isEmpty()) {
      if (sibling == object) {
        return QStringLiteral("%1[%2]").arg(className).arg(index);
      }
      ++index;
    }
  }

  return className;
}

QString BuildObjectPath(QObject* object) {
  QStringList segments;
  auto* current = object;
  while (current) {
    segments.prepend(PathSegmentForObject(current));
    current = current->parent();
  }
  return segments.join('/');
}

void AppendPropertyIfPresent(QJsonObject& properties, QObject* object, const char* propertyName) {
  const int index = object->metaObject()->indexOfProperty(propertyName);
  if (index < 0) {
    return;
  }
  QMetaProperty property = object->metaObject()->property(index);
  if (!property.isReadable()) {
    return;
  }
  properties.insert(QString::fromUtf8(propertyName), VariantToJson(property.read(object)));
}

std::optional<QVariant> ReadProperty(QObject* object, const QString& propertyName) {
  const int propertyIndex = object->metaObject()->indexOfProperty(propertyName.toUtf8().constData());
  if (propertyIndex >= 0) {
    QMetaProperty property = object->metaObject()->property(propertyIndex);
    if (!property.isReadable()) {
      return std::nullopt;
    }
    return property.read(object);
  }

  const QVariant value = object->property(propertyName.toUtf8().constData());
  if (!value.isValid()) {
    return std::nullopt;
  }
  return value;
}

bool WriteProperty(QObject* object, const QString& propertyName, const QVariant& value, QString* errorMessage) {
  const int propertyIndex = object->metaObject()->indexOfProperty(propertyName.toUtf8().constData());
  if (propertyIndex < 0) {
    if (errorMessage) {
      *errorMessage = QStringLiteral("property not found");
    }
    return false;
  }

  QMetaProperty property = object->metaObject()->property(propertyIndex);
  if (!property.isWritable()) {
    if (errorMessage) {
      *errorMessage = QStringLiteral("property is not writable");
    }
    return false;
  }

  QVariant converted = value;
  const QMetaType targetType = property.metaType();
  if (targetType.isValid() && converted.isValid() && converted.metaType() != targetType) {
    if (!converted.convert(targetType)) {
      if (errorMessage) {
        *errorMessage = QStringLiteral("property type conversion failed");
      }
      return false;
    }
  }

  if (!property.write(object, converted)) {
    if (errorMessage) {
      *errorMessage = QStringLiteral("property write failed");
    }
    return false;
  }

  return true;
}

QVector<QMetaMethod> FindInvokableMethods(QObject* object, const QString& methodName, int parameterCount) {
  QVector<QMetaMethod> matches;
  const QMetaObject* metaObject = object->metaObject();
  for (int i = 0; i < metaObject->methodCount(); ++i) {
    QMetaMethod method = metaObject->method(i);
    if (QString::fromLatin1(method.name()) == methodName && method.parameterCount() == parameterCount) {
      matches.push_back(method);
    }
  }
  return matches;
}

bool InvokeMetaMethod(QObject* object, const QMetaMethod& method, const QVector<QVariant>& args) {
  QGenericArgument genericArgs[10];
  for (int i = 0; i < args.size() && i < 10; ++i) {
    genericArgs[i] = QGenericArgument(args[i].typeName(), args[i].constData());
  }

  switch (args.size()) {
    case 0:
      return method.invoke(object, Qt::DirectConnection);
    case 1:
      return method.invoke(object, Qt::DirectConnection, genericArgs[0]);
    case 2:
      return method.invoke(object, Qt::DirectConnection, genericArgs[0], genericArgs[1]);
    case 3:
      return method.invoke(object, Qt::DirectConnection, genericArgs[0], genericArgs[1], genericArgs[2]);
    case 4:
      return method.invoke(object, Qt::DirectConnection, genericArgs[0], genericArgs[1], genericArgs[2], genericArgs[3]);
    case 5:
      return method.invoke(object, Qt::DirectConnection, genericArgs[0], genericArgs[1], genericArgs[2], genericArgs[3], genericArgs[4]);
    case 6:
      return method.invoke(object, Qt::DirectConnection, genericArgs[0], genericArgs[1], genericArgs[2], genericArgs[3], genericArgs[4], genericArgs[5]);
    case 7:
      return method.invoke(object, Qt::DirectConnection, genericArgs[0], genericArgs[1], genericArgs[2], genericArgs[3], genericArgs[4], genericArgs[5], genericArgs[6]);
    case 8:
      return method.invoke(object, Qt::DirectConnection, genericArgs[0], genericArgs[1], genericArgs[2], genericArgs[3], genericArgs[4], genericArgs[5], genericArgs[6], genericArgs[7]);
    case 9:
      return method.invoke(object, Qt::DirectConnection, genericArgs[0], genericArgs[1], genericArgs[2], genericArgs[3], genericArgs[4], genericArgs[5], genericArgs[6], genericArgs[7], genericArgs[8]);
    case 10:
      return method.invoke(object, Qt::DirectConnection, genericArgs[0], genericArgs[1], genericArgs[2], genericArgs[3], genericArgs[4], genericArgs[5], genericArgs[6], genericArgs[7], genericArgs[8], genericArgs[9]);
    default:
      return false;
  }
}

QJsonObject SerializeObject(QObject* object, int depth, int maxDepth, int* nodeCount = nullptr) {
  if (nodeCount) {
    *nodeCount += 1;
  }

  QJsonObject node{
    {"className", object->metaObject()->className()},
    {"objectName", object->objectName()},
    {"path", BuildObjectPath(object)},
  };

  QJsonObject properties;
  AppendPropertyIfPresent(properties, object, "text");
  AppendPropertyIfPresent(properties, object, "title");
  AppendPropertyIfPresent(properties, object, "windowTitle");
  AppendPropertyIfPresent(properties, object, "enabled");
  AppendPropertyIfPresent(properties, object, "visible");
  AppendPropertyIfPresent(properties, object, "checked");
  AppendPropertyIfPresent(properties, object, "value");

  if (auto* widget = qobject_cast<QWidget*>(object)) {
    const QRect geometry = widget->geometry();
    properties.insert("geometry", QJsonObject{
      {"x", geometry.x()},
      {"y", geometry.y()},
      {"w", geometry.width()},
      {"h", geometry.height()},
    });
  }

  if (!properties.isEmpty()) {
    node.insert("properties", properties);
  }

  if (depth >= maxDepth) {
    return node;
  }

  QJsonArray children;
  for (QObject* child : object->children()) {
    children.append(SerializeObject(child, depth + 1, maxDepth, nodeCount));
  }

  if (!children.isEmpty()) {
    node.insert("children", children);
  }

  return node;
}

QList<QObject*> RootObjects() {
  QList<QObject*> roots;
  auto* coreApp = QCoreApplication::instance();
  if (!coreApp) {
    return roots;
  }

  if (auto* guiApp = qobject_cast<QGuiApplication*>(coreApp)) {
    for (QWindow* window : guiApp->topLevelWindows()) {
      if (!roots.contains(window)) {
        roots.append(window);
      }
    }
  }

  if (auto* app = qobject_cast<QApplication*>(coreApp)) {
    for (QWidget* widget : app->topLevelWidgets()) {
      if (!roots.contains(widget)) {
        roots.append(widget);
      }
    }
  }

#ifdef UBRIDGE_QT_HAS_QML
  for (auto* engine : coreApp->findChildren<QQmlApplicationEngine*>()) {
    for (QObject* root : engine->rootObjects()) {
      if (!roots.contains(root)) {
        roots.append(root);
      }
    }
  }
#endif

  if (roots.isEmpty()) {
    roots = coreApp->children();
  }

  return roots;
}

bool CaptureObjectPng(QObject* object, QByteArray* png, int* width, int* height, QString* errorMessage) {
  if (!object || !png || !width || !height) {
    if (errorMessage) {
      *errorMessage = QStringLiteral("capture parameters are invalid");
    }
    return false;
  }

  QPixmap pixmap;

  if (auto* widget = qobject_cast<QWidget*>(object)) {
    pixmap = widget->grab();
  }

#ifdef UBRIDGE_QT_HAS_QML
  if (pixmap.isNull()) {
    if (auto* quickWindow = qobject_cast<QQuickWindow*>(object)) {
      pixmap = QPixmap::fromImage(quickWindow->grabWindow());
    } else if (auto* quickItem = qobject_cast<QQuickItem*>(object)) {
      auto* quickWindow = quickItem->window();
      if (!quickWindow) {
        if (errorMessage) {
          *errorMessage = QStringLiteral("QQuickItem has no window");
        }
        return false;
      }

      const QImage fullImage = quickWindow->grabWindow();
      const QRect cropRect = quickItem
        ->mapRectToScene(QRectF(0, 0, quickItem->width(), quickItem->height()))
        .toAlignedRect()
        .intersected(fullImage.rect());

      if (cropRect.isEmpty()) {
        if (errorMessage) {
          *errorMessage = QStringLiteral("QQuickItem capture rect is empty");
        }
        return false;
      }

      pixmap = QPixmap::fromImage(fullImage.copy(cropRect));
    }
  }
#endif

  if (pixmap.isNull()) {
    if (errorMessage) {
      *errorMessage = QStringLiteral("object is not capturable");
    }
    return false;
  }

  QBuffer buffer(png);
  buffer.open(QIODevice::WriteOnly);
  if (!pixmap.save(&buffer, "PNG")) {
    if (errorMessage) {
      *errorMessage = QStringLiteral("PNG encoding failed");
    }
    return false;
  }

  *width = pixmap.width();
  *height = pixmap.height();
  return true;
}

QObject* FindChildBySegment(QObject* parent, const QString& segment) {
  for (QObject* child : parent->children()) {
    if (PathSegmentForObject(child) == segment) {
      return child;
    }
  }
  return nullptr;
}

QObject* ResolveObjectPath(const QString& path) {
  const QStringList segments = path.split('/', Qt::SkipEmptyParts);
  if (segments.isEmpty()) {
    return nullptr;
  }

  for (QObject* root : RootObjects()) {
    if (PathSegmentForObject(root) != segments.front()) {
      continue;
    }

    QObject* current = root;
    bool matched = true;
    for (int i = 1; i < segments.size(); ++i) {
      current = FindChildBySegment(current, segments[i]);
      if (!current) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return current;
    }
  }

  return nullptr;
}

void CollectMatches(QObject* object, const QString& query, QJsonArray& matches) {
  const QString className = object->metaObject()->className();
  if (object->objectName().contains(query, Qt::CaseInsensitive) ||
      className.contains(query, Qt::CaseInsensitive)) {
    matches.append(QJsonObject{
      {"className", className},
      {"objectName", object->objectName()},
      {"path", BuildObjectPath(object)},
    });
  }

  for (QObject* child : object->children()) {
    CollectMatches(child, query, matches);
  }
}

QJsonObject MakeSuccessResponse(int id, const QJsonValue& result, const QJsonObject& meta = QJsonObject{}) {
  QJsonObject response{
    {"jsonrpc", "2.0"},
    {"id", id},
    {"result", result},
  };
  if (!meta.isEmpty()) {
    response.insert("meta", meta);
  }
  return response;
}

QJsonObject MakeErrorResponse(int id, const QString& message, const QJsonObject& meta = QJsonObject{}) {
  QJsonObject response{
    {"jsonrpc", "2.0"},
    {"id", id},
    {"error", QJsonObject{
      {"code", -32000},
      {"message", message},
    }},
  };
  if (!meta.isEmpty()) {
    response.insert("meta", meta);
  }
  return response;
}

bool WriteJson(HANDLE pipe, const QJsonObject& payload) {
  const QByteArray buffer = QJsonDocument(payload).toJson(QJsonDocument::Compact) + '\n';
  DWORD written = 0;
  return WriteFile(pipe, buffer.constData(), static_cast<DWORD>(buffer.size()), &written, nullptr) == TRUE;
}

QJsonObject HandleRequest(const QJsonObject& request) {
  const int id = request.value("id").toInt();
  const QString method = request.value("method").toString();
  const QJsonObject params = request.value("params").toObject();

  if (method.isEmpty()) {
    return MakeErrorResponse(id, "method is required");
  }

  const auto requestStartedAt = Clock::now();
  QJsonObject meta{
    {"method", method},
  };
  QJsonObject response;
  const bool ok = RunOnQtThread([&]() {
    if (method == "getObjectTree") {
      const int maxDepth = std::max(1, params.value("maxDepth").toInt(4));
      int nodeCount = 0;
      QJsonArray roots;
      const QList<QObject*> rootObjects = RootObjects();
      for (QObject* root : rootObjects) {
        roots.append(SerializeObject(root, 0, maxDepth, &nodeCount));
      }
      meta.insert("rootCount", static_cast<int>(roots.size()));
      meta.insert("nodeCount", nodeCount);
      meta.insert("maxDepth", maxDepth);
      response = MakeSuccessResponse(id, QJsonObject{{"roots", roots}});
      return;
    }

    if (method == "findObject") {
      const QString query = params.value("query").toString();
      if (query.trimmed().isEmpty()) {
        response = MakeErrorResponse(id, "query is required");
        return;
      }
      QJsonArray matches;
      for (QObject* root : RootObjects()) {
        CollectMatches(root, query, matches);
      }
      meta.insert("queryLength", query.size());
      meta.insert("matchCount", static_cast<int>(matches.size()));
      response = MakeSuccessResponse(id, matches);
      return;
    }

    const QString objectPath = params.value("objectPath").toString();
    QObject* object = ResolveObjectPath(objectPath);
    if (!object) {
      response = MakeErrorResponse(id, "object not found");
      return;
    }

    if (method == "getProperty") {
      const QString property = params.value("property").toString();
      meta.insert("property", property);
      const auto value = ReadProperty(object, property);
      if (!value.has_value()) {
        response = MakeErrorResponse(id, "property not found");
      } else {
        response = MakeSuccessResponse(id, VariantToJson(*value));
      }
      return;
    }

    if (method == "setProperty") {
      const QString property = params.value("property").toString();
      const QVariant value = params.value("value").toVariant();
      QString errorMessage;
      meta.insert("property", property);
      const bool changed = WriteProperty(object, property, value, &errorMessage);
      if (!changed) {
        response = MakeErrorResponse(id, errorMessage.isEmpty() ? "setProperty failed" : errorMessage);
      } else {
        response = MakeSuccessResponse(id, QJsonObject{{"success", true}});
      }
      return;
    }

    if (method == "invokeMethod") {
      const QString methodName = params.value("method").toString();
      const QJsonArray args = params.value("args").toArray();
      if (args.size() > 10) {
        response = MakeErrorResponse(id, "too many arguments");
        return;
      }

      const QVector<QMetaMethod> metaMethods = FindInvokableMethods(object, methodName, args.size());
      meta.insert("argCount", args.size());
      meta.insert("overloadCount", static_cast<int>(metaMethods.size()));
      if (metaMethods.isEmpty()) {
        response = MakeErrorResponse(id, "method overload not found");
        return;
      }

      bool invoked = false;
      QString selectedSignature;
      for (const QMetaMethod& metaMethod : metaMethods) {
        QVector<QVariant> convertedArgs;
        convertedArgs.reserve(args.size());
        const QList<QByteArray> parameterTypes = metaMethod.parameterTypes();
        bool conversionFailed = false;

        for (int i = 0; i < args.size(); ++i) {
          QVariant converted = args[i].toVariant();
          const QMetaType targetType = QMetaType::fromName(parameterTypes[i].constData());
          if (targetType.isValid() && converted.isValid() && converted.metaType() != targetType) {
            if (!converted.convert(targetType)) {
              conversionFailed = true;
              break;
            }
          }
          convertedArgs.push_back(converted);
        }

        if (conversionFailed) {
          continue;
        }

        if (InvokeMetaMethod(object, metaMethod, convertedArgs)) {
          invoked = true;
          selectedSignature = QString::fromLatin1(metaMethod.methodSignature());
          break;
        }
      }

      if (!invoked) {
        response = MakeErrorResponse(id, "invokeMethod failed");
      } else {
        if (!selectedSignature.isEmpty()) {
          meta.insert("selectedSignature", selectedSignature);
        }
        response = MakeSuccessResponse(id, QJsonObject{{"success", true}});
      }
      return;
    }

    if (method == "screenshot") {
      QByteArray png;
      int width = 0;
      int height = 0;
      QString errorMessage;
      if (!CaptureObjectPng(object, &png, &width, &height, &errorMessage)) {
        response = MakeErrorResponse(id, errorMessage.isEmpty() ? "capture failed" : errorMessage);
        return;
      }

      const QByteArray encoded = png.toBase64();
      meta.insert("width", width);
      meta.insert("height", height);
      meta.insert("pngBytes", png.size());
      meta.insert("base64Bytes", encoded.size());
      response = MakeSuccessResponse(id, QString::fromLatin1(encoded));
      return;
    }

    response = MakeErrorResponse(id, "unsupported method");
  });

  meta.insert("nativeDurationMs", ElapsedMs(requestStartedAt));
  if (!ok) {
    return MakeErrorResponse(id, "Qt runtime is not available", meta);
  }

  response.insert("meta", meta);
  return response;
}

void HandleClient(HANDLE pipe) {
  constexpr DWORD kBufferSize = 8192;
  char buffer[kBufferSize];
  QByteArray pending;

  while (g_running.load()) {
    DWORD bytesRead = 0;
    const BOOL success = ReadFile(pipe, buffer, kBufferSize, &bytesRead, nullptr);
    if (!success || bytesRead == 0) {
      break;
    }

    pending.append(buffer, static_cast<int>(bytesRead));

    while (true) {
      const int newline = pending.indexOf('\n');
      if (newline < 0) {
        break;
      }

      const QByteArray line = pending.left(newline).trimmed();
      pending.remove(0, newline + 1);
      if (line.isEmpty()) {
        continue;
      }

      const QJsonDocument requestDoc = QJsonDocument::fromJson(line);
      if (!requestDoc.isObject()) {
        WriteJson(pipe, MakeErrorResponse(0, "invalid json"));
        continue;
      }

      const QJsonObject response = HandleRequest(requestDoc.object());
      if (!WriteJson(pipe, response)) {
        return;
      }
    }
  }
}

DWORD WINAPI BridgeThreadProc(LPVOID) {
  while (g_running.load()) {
    HANDLE pipe = CreateNamedPipeW(
      PipeNameForCurrentProcess().c_str(),
      PIPE_ACCESS_DUPLEX,
      PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
      1,
      1 << 16,
      1 << 16,
      0,
      nullptr
    );

    if (pipe == INVALID_HANDLE_VALUE) {
      return 1;
    }

    const BOOL connected = ConnectNamedPipe(pipe, nullptr)
      ? TRUE
      : (GetLastError() == ERROR_PIPE_CONNECTED);

    if (connected) {
      HandleClient(pipe);
    }

    DisconnectNamedPipe(pipe);
    CloseHandle(pipe);
  }

  return 0;
}

}  // namespace

extern "C" __declspec(dllexport) DWORD WINAPI UbridgeQtStart(LPVOID) {
  bool expected = false;
  if (!g_started.compare_exchange_strong(expected, true)) {
    return 0;
  }

  g_running.store(true);
  HANDLE thread = CreateThread(nullptr, 0, BridgeThreadProc, nullptr, 0, nullptr);
  if (!thread) {
    g_running.store(false);
    g_started.store(false);
    return 1;
  }

  CloseHandle(thread);
  return 0;
}

BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID) {
  switch (reason) {
    case DLL_PROCESS_ATTACH:
      DisableThreadLibraryCalls(module);
      break;
    case DLL_PROCESS_DETACH:
      g_running.store(false);
      break;
    default:
      break;
  }

  return TRUE;
}
