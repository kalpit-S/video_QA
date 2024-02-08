# YouTube Enhanced Extension for Firefox

## Overview

The YouTube Enhanced Extension is a Firefox add-on designed to enrich the viewing experience on YouTube. It provides users with additional features such as video transcript summarization, enhanced interaction through a chat interface with language model APIs, and more.

## Features

### Transcript Summarization

This feature provides concise summaries of YouTube video transcripts. For transcripts exceeding the model's context window, it uses recursive summarization.

### Interactive Chat Interface

The extension includes a user-friendly chat interface, enabling users to interact directly with it. This allows for specific requests, such as posing questions related to the video content

### Relevance-Aware Question Answering (RAG) System

The extension leverages embeddings and cosine similarity to accurately identify and retrieve the most relevant portions of the video transcript in response to user queries.

### Dynamic Model Interaction

Adaptability is a key feature, the extension allows the user to choose different models on the fly through commands

This format highlights the main features of the extension, organized into distinct sections for quick reference. Each feature is briefly described, emphasizing its utility and the technical approach where relevant.

## Installation

To install this extension on Firefox, follow these steps:

1. **Clone the repository** to your local machine.
2. **Open Firefox** and navigate to `about:debugging`.
3. **Click "This Firefox"** on the left sidebar.
4. **Click "Load Temporary Add-on…"** and select the `manifest.json` file within the cloned directory.
5. The extension is now installed in developer mode and will remain active until you restart Firefox.

## Usage

After installation, navigate to any YouTube video to start using the extension. Here's how to use its features:

- **Type commands** in the chat interface to interact with the extension. Supported commands include:
  - `/clear` or `/c`: Clears the chat history.
  - `/summarize` or `/s`: Summarizes the current video's transcript.
  - `/help` or `/h`: Lists available commands.
