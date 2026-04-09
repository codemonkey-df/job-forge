import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOllama } from 'ollama-ai-provider'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LLMSettings } from '../../types/settings'
import type { LanguageModel } from 'ai'

export function buildModel(settings: LLMSettings): LanguageModel {
  switch (settings.provider) {
    case 'anthropic': {
      const provider = createAnthropic({ apiKey: settings.apiKey ?? '' })
      return provider(settings.model) as unknown as LanguageModel
    }
    case 'google': {
      const provider = createGoogleGenerativeAI({ apiKey: settings.apiKey ?? '' })
      return provider(settings.model) as unknown as LanguageModel
    }
    case 'ollama': {
      const provider = createOllama({
        baseURL: settings.baseUrl ?? 'http://localhost:11434/api',
      })
      return provider(settings.model) as unknown as LanguageModel
    }
    case 'proxy': {
      // OpenAI-compatible endpoint (e.g. LM Studio, vLLM, llama.cpp, custom routers)
      const provider = createOpenAICompatible({
        name: 'proxy',
        baseURL: settings.baseUrl ?? 'http://localhost:8080/v1',
        apiKey: settings.apiKey ?? 'none',
      })
      return provider(settings.model) as unknown as LanguageModel
    }
  }
}
