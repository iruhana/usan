#include <QColor>
#include <QGuiApplication>
#include <QObject>
#include <QPainter>
#include <QQuickPaintedItem>
#include <QQuickWindow>
#include <QString>

class ValidationBlockItem : public QQuickPaintedItem {
  Q_OBJECT
  Q_PROPERTY(QString label READ label WRITE setLabel NOTIFY labelChanged)
  Q_PROPERTY(QColor fillColor READ fillColor WRITE setFillColor NOTIFY fillColorChanged)
  Q_PROPERTY(QColor textColor READ textColor WRITE setTextColor NOTIFY textColorChanged)

 public:
  explicit ValidationBlockItem(QQuickItem* parent = nullptr)
      : QQuickPaintedItem(parent),
        fillColor_(QStringLiteral("#ffffff")),
        textColor_(QStringLiteral("#111827")) {
    setAntialiasing(true);
  }

  QString label() const { return label_; }
  QColor fillColor() const { return fillColor_; }
  QColor textColor() const { return textColor_; }

  void setLabel(const QString& value) {
    if (label_ == value) {
      return;
    }
    label_ = value;
    update();
    emit labelChanged();
  }

  void setFillColor(const QColor& value) {
    if (fillColor_ == value) {
      return;
    }
    fillColor_ = value;
    update();
    emit fillColorChanged();
  }

  void setTextColor(const QColor& value) {
    if (textColor_ == value) {
      return;
    }
    textColor_ = value;
    update();
    emit textColorChanged();
  }

  void paint(QPainter* painter) override {
    painter->setRenderHint(QPainter::Antialiasing, true);
    painter->fillRect(boundingRect(), QColor(QStringLiteral("#f4f7fb")));
    painter->setPen(Qt::NoPen);
    painter->setBrush(fillColor_);
    painter->drawRoundedRect(boundingRect(), 8.0, 8.0);
    painter->setPen(textColor_);
    painter->drawText(
      boundingRect().adjusted(12.0, 0.0, -12.0, 0.0),
      Qt::AlignLeft | Qt::AlignVCenter,
      label_
    );
  }

 signals:
  void labelChanged();
  void fillColorChanged();
  void textColorChanged();

 private:
  QString label_;
  QColor fillColor_;
  QColor textColor_;
};

class QuickValidationController : public QObject {
  Q_OBJECT
  Q_PROPERTY(QString message READ message WRITE setMessage NOTIFY messageChanged)
  Q_PROPERTY(QString statusText READ statusText WRITE setStatusText NOTIFY statusTextChanged)

 public:
  explicit QuickValidationController(QObject* parent = nullptr)
      : QObject(parent), statusText_(QStringLiteral("Idle")) {}

  QString message() const { return message_; }
  QString statusText() const { return statusText_; }

  void setMessage(const QString& value) {
    if (message_ == value) {
      return;
    }
    message_ = value;
    emit messageChanged();
  }

  void setStatusText(const QString& value) {
    if (statusText_ == value) {
      return;
    }
    statusText_ = value;
    emit statusTextChanged();
  }

  Q_INVOKABLE void applyMessage() {
    setStatusText(QStringLiteral("Quick: %1").arg(message_));
    emit applied();
  }

 signals:
  void messageChanged();
  void statusTextChanged();
  void applied();

 private:
  QString message_;
  QString statusText_;
};

int main(int argc, char* argv[]) {
  QGuiApplication app(argc, argv);

  QQuickWindow window;
  window.setObjectName(QStringLiteral("quickValidationWindow"));
  window.setTitle(QStringLiteral("Qt Bridge Validation Quick"));
  window.setColor(QColor(QStringLiteral("#f4f7fb")));
  window.resize(420, 220);

  auto* controller = new QuickValidationController(&window);
  controller->setObjectName(QStringLiteral("validationController"));

  auto* panel = new QQuickItem(window.contentItem());
  panel->setObjectName(QStringLiteral("quickValidationPanel"));
  panel->setWidth(window.width());
  panel->setHeight(window.height());

  auto* messageInput = new ValidationBlockItem(panel);
  messageInput->setObjectName(QStringLiteral("messageInput"));
  messageInput->setX(24);
  messageInput->setY(28);
  messageInput->setWidth(220);
  messageInput->setHeight(36);
  messageInput->setLabel(QStringLiteral("Message:"));
  messageInput->setFillColor(QColor(QStringLiteral("#ffffff")));

  auto* statusTextLabel = new ValidationBlockItem(panel);
  statusTextLabel->setObjectName(QStringLiteral("statusTextLabel"));
  statusTextLabel->setX(24);
  statusTextLabel->setY(92);
  statusTextLabel->setWidth(260);
  statusTextLabel->setHeight(36);
  statusTextLabel->setLabel(controller->statusText());
  statusTextLabel->setFillColor(QColor(QStringLiteral("#e5e7eb")));

  auto* applyButton = new ValidationBlockItem(panel);
  applyButton->setObjectName(QStringLiteral("applyButton"));
  applyButton->setX(24);
  applyButton->setY(138);
  applyButton->setWidth(120);
  applyButton->setHeight(40);
  applyButton->setLabel(QStringLiteral("Apply"));
  applyButton->setFillColor(QColor(QStringLiteral("#2563eb")));
  applyButton->setTextColor(QColor(QStringLiteral("#ffffff")));

  QObject::connect(controller, &QuickValidationController::messageChanged, messageInput, [controller, messageInput]() {
    if (controller->message().isEmpty()) {
      messageInput->setLabel(QStringLiteral("Message:"));
      return;
    }
    messageInput->setLabel(QStringLiteral("Message: %1").arg(controller->message()));
  });

  QObject::connect(controller, &QuickValidationController::statusTextChanged, statusTextLabel, [controller, statusTextLabel]() {
    statusTextLabel->setLabel(controller->statusText());
  });

  window.show();
  return app.exec();
}

#include "main.moc"
