browser.commands.onCommand.addListener(function (command) {
  if (command === "activate") {
    browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      browser.tabs.sendMessage(tabs[0].id, { action: "activate" });
    });
  }
});
