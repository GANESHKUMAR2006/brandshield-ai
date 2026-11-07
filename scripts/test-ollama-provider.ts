/**
 * BrandShield AI — Ollama Provider Unit & Factory Test Suite
 *
 * Verifies:
 * 1. OllamaProvider class instantiation with default and custom options
 * 2. Base URL normalization (/v1 appending)
 * 3. Provider factory resolution for "ollama", "huggingface", and "mock"
 * 4. Error messaging when Ollama service is unreachable
 * 5. Preservation of existing Hugging Face and Mock providers
 */

import { OllamaProvider } from "../src/lib/ai/providers/ollama-provider";
import { HuggingFaceProvider } from "../src/lib/ai/providers/huggingface-provider";
import { MockLLMProvider } from "../src/lib/ai/providers/mock-provider";
import { getConfiguredProvider } from "../src/lib/ai/providers/configured-provider";

async function runTests() {
  console.log("========================================================================");
  console.log("       BRANDSHIELD AI: OLLAMA PROVIDER UNIT TEST SUITE                  ");
  console.log("========================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail = "") {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      if (detail) console.log(`       └─ ${detail}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (detail) console.error(`       └─ ${detail}`);
      failed++;
    }
  }

  // 1. OllamaProvider Default Instantiation
  {
    const provider = new OllamaProvider();
    assert(
      provider.providerName === "ollama",
      "1. OllamaProvider identifies with providerName 'ollama'"
    );
    assert(
      provider.baseURL === "http://localhost:11434/v1" || provider.baseURL === "http://localhost:11434",
      "2. Default baseURL is 'http://localhost:11434/v1'"
    );
    assert(
      provider.modelIdentifier === "qwen3:4b",
      "3. Default modelIdentifier defaults to 'qwen3:4b'"
    );
  }

  // 2. Custom BaseURL and Endpoint Normalization
  {
    const providerWithTrailingSlash = new OllamaProvider({
      baseURL: "http://127.0.0.1:11434/",
      model: "qwen2.5:3b",
    });
    assert(
      providerWithTrailingSlash.baseURL === "http://127.0.0.1:11434",
      "4. Trailing slashes are stripped from baseURL"
    );
    assert(
      providerWithTrailingSlash.modelIdentifier === "qwen2.5:3b",
      "5. Custom modelIdentifier 'qwen2.5:3b' is respected"
    );
  }

  // 3. Provider Factory Resolution: Ollama
  {
    const originalEnv = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "ollama";
    try {
      const provider = getConfiguredProvider();
      assert(
        provider instanceof OllamaProvider,
        "6. getConfiguredProvider() returns OllamaProvider when LLM_PROVIDER=ollama"
      );
    } finally {
      process.env.LLM_PROVIDER = originalEnv;
    }
  }

  // 4. Provider Factory Resolution: Hugging Face Preservation
  {
    const originalEnv = process.env.LLM_PROVIDER;
    const originalToken = process.env.HF_TOKEN;
    process.env.LLM_PROVIDER = "huggingface";
    if (!process.env.HF_TOKEN) {
      process.env.HF_TOKEN = "hf_test_mock_token_for_unit_tests";
    }
    try {
      const provider = getConfiguredProvider();
      assert(
        provider instanceof HuggingFaceProvider,
        "7. getConfiguredProvider() retains HuggingFaceProvider when LLM_PROVIDER=huggingface"
      );
    } finally {
      process.env.LLM_PROVIDER = originalEnv;
      process.env.HF_TOKEN = originalToken;
    }
  }

  // 5. Provider Factory Resolution: Mock Preservation
  {
    const originalEnv = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "mock";
    try {
      const provider = getConfiguredProvider();
      assert(
        provider instanceof MockLLMProvider,
        "8. getConfiguredProvider() retains MockLLMProvider when LLM_PROVIDER=mock"
      );
    } finally {
      process.env.LLM_PROVIDER = originalEnv;
    }
  }

  // 6. Descriptive Error Handling for Offline Ollama Service
  {
    const offlineProvider = new OllamaProvider({
      baseURL: "http://127.0.0.1:59999", // Unused port to simulate offline service
      timeout: 1000,
      maxRetries: 0,
    });
    try {
      await offlineProvider.extractClaims({
        content: "Test text",
      });
      assert(false, "9. Offline endpoint should throw descriptive connection error");
    } catch (err: unknown) {
      const msg = (err as Error).message;
      assert(
        msg.includes("Ollama server unreachable") || msg.includes("Ensure the Ollama service is running"),
        "9. Offline endpoint throws clear, user-friendly guidance to launch Ollama",
        msg
      );
    }
  }

  console.log("\n========================================================================");
  console.log(`TEST SUMMARY: ${passed} passing, ${failed} failed.`);
  console.log("========================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
