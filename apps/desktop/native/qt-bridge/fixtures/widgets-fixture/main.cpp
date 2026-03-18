#include <QApplication>
#include <QLabel>
#include <QLineEdit>
#include <QMainWindow>
#include <QPushButton>
#include <QVBoxLayout>
#include <QWidget>

int main(int argc, char* argv[]) {
  QApplication app(argc, argv);

  QMainWindow window;
  window.setObjectName(QStringLiteral("ValidationMainWindow"));
  window.setWindowTitle(QStringLiteral("Qt Bridge Validation Widgets"));
  window.resize(420, 220);

  auto* centralPanel = new QWidget(&window);
  centralPanel->setObjectName(QStringLiteral("centralPanel"));
  auto* layout = new QVBoxLayout(centralPanel);

  auto* statusLabel = new QLabel(QStringLiteral("Idle"), centralPanel);
  statusLabel->setObjectName(QStringLiteral("statusLabel"));

  auto* nameInput = new QLineEdit(centralPanel);
  nameInput->setObjectName(QStringLiteral("nameInput"));
  nameInput->setPlaceholderText(QStringLiteral("Type a name"));

  auto* confirmButton = new QPushButton(QStringLiteral("Confirm"), centralPanel);
  confirmButton->setObjectName(QStringLiteral("confirmButton"));

  layout->addWidget(statusLabel);
  layout->addWidget(nameInput);
  layout->addWidget(confirmButton);

  QObject::connect(confirmButton, &QPushButton::clicked, [&]() {
    statusLabel->setText(QStringLiteral("Confirmed: %1").arg(nameInput->text()));
  });

  window.setCentralWidget(centralPanel);
  window.show();

  return app.exec();
}
