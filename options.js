document.getElementById("saveButton").addEventListener("click", function () {
  const llmModel = document.getElementById("llmModel").value;
  const geminiApiKey = document.getElementById("geminiApiKey").value;
  const openaiApiKey = document.getElementById("openaiApiKey").value;
  const maxContextLength = document.getElementById("maxContextLength").value;
  const numResults = document.getElementById("numResults").value;
  const chunkSize = document.getElementById("chunkSize").value;
  browser.storage.local.set(
    {
      llmModel: llmModel,
      geminiApiKey: geminiApiKey,
      openaiApiKey: openaiApiKey,
      maxContextLength: maxContextLength,
      numResults: numResults,
      chunkSize: chunkSize,
    },
    function () {
      console.log("Options saved");
    }
  );
});
