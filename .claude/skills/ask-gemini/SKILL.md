---
name: ask-gemini
description: Use when user explicitly asks Gemini to answer a question - phrases like "ask Gemini...", "use Gemini to...", "what does Gemini say about..." - sends question to Gemini CLI and returns response directly
---

# Ask Gemini

Send questions to Google's Gemini models via the Gemini CLI.

## Triggers

Use this skill when user says:
- "ask Gemini..."
- "use Gemini to..."
- "what does Gemini say/think about..."
- "check with Gemini..."

## Model Selection

| User says | Model used |
|-----------|------------|
| (default) | `gemini-3-pro-preview` |
| "...flash..." | `gemini-2.5-flash` |
| "...pro..." | `gemini-3-pro-preview` |

## Execution

**Environment Variables:**

Always set these environment variables before running gemini commands to ensure proper authentication and configuration, especially in agent contexts:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/Users/kjzc236/.config/gcloud/service-account-key.json
export GOOGLE_CLOUD_PROJECT=gcp-rnd-chatbot-1783-poc-ee44
export GOOGLE_CLOUD_LOCATION=global
export GOOGLE_GENAI_USE_VERTEXAI=true
```

**Question only (default):**
```bash
GOOGLE_APPLICATION_CREDENTIALS=/Users/kjzc236/.config/gcloud/service-account-key.json \
GOOGLE_CLOUD_PROJECT=gcp-rnd-chatbot-1783-poc-ee44 \
GOOGLE_CLOUD_LOCATION=global \
GOOGLE_GENAI_USE_VERTEXAI=true \
gemini -m gemini-3-pro-preview --yolo -o text "USER_QUESTION"
```

**With context** (user says "about this", "about our discussion"):
```bash
GOOGLE_APPLICATION_CREDENTIALS=/Users/kjzc236/.config/gcloud/service-account-key.json \
GOOGLE_CLOUD_PROJECT=gcp-rnd-chatbot-1783-poc-ee44 \
GOOGLE_CLOUD_LOCATION=global \
GOOGLE_GENAI_USE_VERTEXAI=true \
gemini -m gemini-3-pro-preview -approval-mode --yolo -o text "CONTEXT_SUMMARY

Question: USER_QUESTION"
```

## Workflow

1. Extract the question from user's request
2. Check for model override keywords (flash, pro)
3. Check if context is needed ("about this", "about our discussion")
4. If context needed: summarize relevant conversation context
5. Run gemini CLI command
6. Return Gemini's response directly (no reformatting)

## Error Handling

- CLI not found: Tell user to install/configure Gemini CLI
- Empty response: Note that Gemini returned no response
- CLI error: Show error message
- CLI flags error : use gemeni --help to learn how to use it 
