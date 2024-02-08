// content.js: Interacts with YouTube pages and handles messages from the background script
// Check if the transcript is already open on the page

let text_chunks = {};
let defaultModel;
let geminiApiKey;
let openaiApiKey;
let llmContextWindow;
let numChunks;
let defaultChunkSize;
let videoDescription;
// Get values from local storage when the page loads
window.onload = function () {
  browser.storage.local.get(
    [
      "llmModel",
      "geminiApiKey",
      "openaiApiKey",
      "maxContextLength",
      "numResults",
      "chunkSize",
    ],
    function (result) {
      defaultModel = result.llmModel;
      geminiApiKey = result.geminiApiKey;
      openaiApiKey = result.openaiApiKey;
      llmContextWindow = result.maxContextLength;
      numChunks = result.numResults;
      defaultChunkSize = result.chunkSize;
    }
  );
};

// Check if the transcript is already open on the page
function isTranscriptOpen() {
  return !!document.querySelector("ytd-transcript-segment-renderer");
}
// Function to open the YouTube video transcript
function openTranscript() {
  const showMoreButton = document.querySelector("tp-yt-paper-button#expand");
  if (showMoreButton) {
    showMoreButton.click();
  }
  // Wait for the 'Show transcript' button to appear and click it
  return new Promise((resolve) => {
    setTimeout(() => {
      const buttons = document.querySelectorAll("button");
      for (let button of buttons) {
        if (button.innerText.includes("Show transcript")) {
          button.click();
          break;
        }
      }
      resolve();
    }, 2000);
  });
}
// Extracts and returns the transcript of the video as a string
function extractDescriptionAndFormattedTimestamps() {
  // Assuming 'description-inline-expander' is the container ID for the description
  const descriptionContainer = document.getElementById(
    "description-inline-expander"
  );
  if (!descriptionContainer) return "Description not found.";

  // Extract description text
  const descriptionText = descriptionContainer.innerText;

  // Extract timestamps - looking for 'a' tags with specific format
  const timestampLinks = descriptionContainer.querySelectorAll("a");
  const timestampsFormatted = Array.from(timestampLinks)
    .map((link) => `${link.innerText} - ${link.href}`)
    .join("\n"); // Joining each timestamp with a newline for readability

  // Combine description and timestamps into a single string
  const combinedString = `Description:\n${descriptionText}\n\nTimestamps:\n${timestampsFormatted}`;

  return combinedString;
}

// Get the video transcript and return it as a string
async function getVideoTranscript() {
  if (!isTranscriptOpen()) {
    await openTranscript();
    // Wait additional time for the transcript to fully load
    await new Promise((resolve) => setTimeout(resolve, 2000));
    videoDescription = extractDescriptionAndFormattedTimestamps();
  }
  const transcriptSegments = document.querySelectorAll(
    "ytd-transcript-segment-renderer"
  );
  let transcript = "";
  for (let segment of transcriptSegments) {
    const timestampText = segment
      .querySelector(".segment-timestamp")
      .textContent.trim();
    const text = segment.querySelector(".segment-text").textContent.trim();
    transcript += ` [${timestampText}] ${text}`;
  }
  return transcript;
}
// Show a loading message in the chatbox
function showLoading(chatbox) {
  let loadingElement = document.createElement("p");
  loadingElement.id = "loading";
  loadingElement.innerHTML = "Loading...";
  chatbox.appendChild(loadingElement);
}
// Hide the loading message in the chatbox
function hideLoading() {
  let loadingElement = document.getElementById("loading");
  if (loadingElement) {
    loadingElement.remove();
  }
}

// Creates the chat interface
function createChatInterface() {
  //console.log("Creating chat interface...");
  const chatInterface = document.createElement("div");
  chatInterface.id = "chatInterface";
  chatInterface.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background-color: #333333;
        border-radius: 15px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        width: 300px;
        max-width: 80%;
        padding: 10px;
        z-index: 1000;
        font-family: 'Roboto', sans-serif;
        transition: background-color 0.3s;
    `;

  // Add a minimize/maximize button
  const toggleButton = document.createElement("button");
  toggleButton.id = "toggleButton";
  toggleButton.style.cssText = `
        background-color: #555;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
        position: absolute;
        top: 10px;
        right: 10px;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
  toggleButton.textContent = "−";

  // Set inner HTML content for chat interface
  chatInterface.innerHTML = `
        <div id="innerChatbox" style="height: 300px; overflow-y: auto; margin-bottom: 10px; padding: 10px; background: #222222; border-radius: 10px; color: #FFFFFF;">
        </div>
        <div style="display: flex; gap: 10px;">
            <input id="inputField" type="text" placeholder="Type your message here" style="flex-grow: 1; width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #555555; border-radius: 5px; background-color: #333333; color: #FFFFFF;">
        </div>
    `;

  chatInterface.appendChild(toggleButton);
  document.body.appendChild(chatInterface);

  // Event listener for the toggle button
  let isMinimized = false;
  toggleButton.addEventListener("click", () => {
    const chatbox = document.getElementById("innerChatbox");
    const inputField = document.getElementById("inputField");
    if (isMinimized) {
      chatbox.style.display = "block";
      inputField.style.display = "block";
      toggleButton.textContent = "−";
    } else {
      chatbox.style.display = "none";
      inputField.style.display = "none";
      toggleButton.textContent = "+";
    }
    isMinimized = !isMinimized;
  });

  const inputField = document.getElementById("inputField");

  // Event listener for the 'Enter' key in the input field
  inputField.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSendButtonClick();
    }
  });
}

setTimeout(createChatInterface, 3000);

// handles all inputs from the user
function handleSendButtonClick() {
  const inputField = document.getElementById("inputField");
  const chatbox = document.getElementById("innerChatbox");

  if (!inputField || inputField.value.trim() === "") {
    return;
  }
  const trimmedInput = inputField.value.trim();
  inputField.value = "";

  appendMessageToChatbox(chatbox, trimmedInput, false);

  if (trimmedInput.startsWith("/")) {
    const command = trimmedInput.split(" ")[0].toLowerCase();

    if (command === "/clear" || command === "/c") {
      chatbox.innerHTML = "";
    } else if (command === "/summarize" || command === "/s") {
      getVideoTranscript()
        .then((video_transcript) => Summarize(video_transcript))
        .then((summary) => {
          hideLoading();
          appendMessageToChatbox(chatbox, summary);
        })
        .catch((error) => {
          hideLoading();
          appendMessageToChatbox(
            chatbox,
            `Error fetching transcript: ${error}`
          );
        });
    } else if (command === "/img") {
      //console.log("Image command not currently supported");
    } else if (command === "/help" || command === "/h") {
      const helpMessage = `Commands: /clear or /c to clear chat, /summarize or /s to summarize video`;
      appendMessageToChatbox(chatbox, helpMessage);
    } else if (command === "/e") {
      getVideoTranscript().then((video_transcript) =>
        processTranscript(video_transcript)
      );
    } else if (trimmedInput.startsWith("/m ")) {
      // example usage: /m gpt What is the capital of France?
      let parts = trimmedInput.split(" ");
      let modelName = parts[1]; // Get the model name
      let userQuestion = parts.slice(2).join(" "); // Get the user question

      callLLMAPI(userQuestion, modelName).then((response) => {
        appendMessageToChatbox(
          chatbox,
          `<strong>${modelName}:</strong> ${response}`
        );
      });
    } else {
      appendMessageToChatbox(
        chatbox,
        `Invalid command. Type /help or /h to see a list of commands.`
      );
    }
  } else {
    sendMessageToLLMAPI(chatbox, trimmedInput);
  }
}

// Append a message to the chatbox
function appendMessageToChatbox(chatbox, message, isAI = true) {
  let messageElement = document.createElement("p");
  if (isAI) {
    messageElement.innerHTML = `<strong>AI:</strong> ${message.replace(
      /\n/g,
      "<br>"
    )}`; // Add "AI: " before appending the text
  } else {
    messageElement.innerHTML = `<strong>User:</strong> ${message.replace(
      /\n/g,
      "<br>"
    )}`; // Add "User: " before appending the text
  }
  chatbox.appendChild(messageElement);
  let newLineElement = document.createElement("p");
  chatbox.appendChild(newLineElement);
}

//crafts the input for the LLM API and sends the message to the chatbox
async function sendMessageToLLMAPI(chatbox, userInput) {
  //console.log("Sending message to LLM API");
  const CHAT_HISTORY_LIMIT = 256;
  const chatHistory = chatbox.textContent.slice(-CHAT_HISTORY_LIMIT);
  const input_vector = await fetchEmbeddings(userInput);
  if (!text_chunks) {
    processTranscript(await getVideoTranscript());
  }
  const relevantSections = findMostRelevantSections(input_vector, text_chunks);
  let combinedInput = `
    Video Description: ${videoDescription}
    Transcript Chunks:
    ---
    ${relevantSections}
    Conversation so far, you are 'AI': ${chatHistory}
    ---
    Last User Input that you are responding to: ${userInput}
    ---
    Feel free to not use the transcript chunks if they aren't helpful and just answer the question using knowledge you already have. Only respond using html format. For your response complete this: <body>
  `;
  //console.log(combinedInput);
  callLLMAPI(combinedInput, defaultModel).then((result) => {
    appendMessageToChatbox(chatbox, `${result}`);
  });
}

//todo add a way to change to specific models
function callLLMAPI(prompt, model = "gpt-3.5-turbo-0125") {
  if (model.includes("gpt")) {
    return callOpenAI(prompt, model);
  } else if (model.includes("gemini")) {
    return callGemini(prompt);
  }
}

function callOpenAI(prompt, model) {
  //console.log("Calling LLM API");
  //console.log("Prompt: ", prompt);
  const apiUrl = "https://api.openai.com/v1/chat/completions";
  const API_KEY = openaiApiKey;

  return fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant, your job is to answer the user's questions about a video",
        },
        { role: "user", content: prompt },
      ],
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      //console.log("OpenAI API response:", data);
      return data.choices[0].message.content;
    })
    .catch((error) => {
      console.error("Error calling OpenAI API:", error);
      throw error;
    });
}

function callGemini(prompt, model = "gemini-pro") {
  //console.log("Calling Google Cloud AI API");
  const API_KEY = geminiApiKey;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })
    .then((response) => response.json())
    .then((data) => {
      //console.log("Gemini API response:", data);

      // Extracting the text message from the response
      const message = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (message) {
        return message;
      } else {
        throw new Error("Message not found in the response");
      }
    })
    .catch((error) => {
      console.error("Error calling Gemini API:", error);
      throw error;
    });
}

// Process the transcript and generate embeddings for each chunk
async function processTranscript(transcript) {
  const chunks = splitIntoChunks(transcript, 4000);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const embeddingVector = await fetchEmbeddings(chunk);
      if (embeddingVector) {
        text_chunks[`chunk_${i}`] = { text: chunk, embedding: embeddingVector };
      }
    } catch (error) {
      console.error("Error fetching embeddings for chunk", i, error);
    }
  }
  //console.log("Embeddings generated");
  const chatbox = document.getElementById("innerChatbox");
  appendMessageToChatbox(chatbox, "Embeddings generated", true);
}

function splitIntoChunks(text, chunkSize = 750) {
  if (chunkSize < 1) {
    console.error("Invalid chunk size");
    return [];
  }
  if (defaultChunkSize) {
    chunkSize = defaultChunkSize;
  }
  let chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Find Most Relevant Sections based on cosine similarity with the target vector
function findMostRelevantSections(
  targetVector,
  embeddingsDict,
  numResults = 2
) {
  if (defaultChunkSize) {
    numResults = defaultChunkSize;
  }
  let scores = [];
  for (const [chunkId, data] of Object.entries(embeddingsDict)) {
    let score = cosineSimilarity(targetVector, data.embedding);
    scores.push({ chunkId, score, text: data.text });
  }

  // Sort the scores and get the top N results
  scores.sort((a, b) => b.score - a.score);
  let topScores = scores.slice(0, numResults);

  // Combine the text from top scoring chunks
  return topScores.map((score) => `${score.text}\n---\n`).join("\n");
}

// returns the embedding vector of the input
async function fetchEmbeddings(inputText) {
  const OPENAI_API_KEY = openaiApiKey;
  const url = "https://api.openai.com/v1/embeddings";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: inputText,
        model: "text-embedding-3-small",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    if (!responseData || !responseData.data || responseData.data.length === 0) {
      throw new Error("No embedding data found in response");
    }

    return responseData.data[0].embedding;
  } catch (error) {
    console.error("Error fetching embeddings:", error);
    return null;
  }
}

async function Summarize(text, maxContextLength = 16000) {
  if (llmContextWindow) {
    maxContextLength = llmContextWindow;
  }

  const preprompt = `
        <h1>Summary of the Video Transcript</h1>
        <!-- Insert HTML-formatted summary below, make sure to include the main points -->
        `;

  const totalWordCount = (str) => str.split(" ").length;

  const summarizeChunk = async (chunk) => {
    return await callLLMAPI(preprompt + chunk);
  };

  const recursiveSummarize = async (inputText, isFinal = false) => {
    const chunkSize = isFinal
      ? maxContextLength
      : Math.floor(maxContextLength / 2);
    let summaries = [];

    for (let start = 0; start < inputText.length; start += chunkSize) {
      const chunk = inputText.substring(start, start + chunkSize);
      summaries.push(await summarizeChunk(chunk));
    }

    const summarizedText = summaries.join("\n\n");
    if (totalWordCount(summarizedText) > maxContextLength && !isFinal) {
      return recursiveSummarize(summarizedText, true);
    } else {
      return summarizeChunk(summarizedText);
    }
  };

  return totalWordCount(text) < maxContextLength * 0.8
    ? await summarizeChunk(text)
    : await recursiveSummarize(text);
}
