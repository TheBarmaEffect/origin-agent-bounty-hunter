import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We'll test handleRequest directly, mocking the facilitator

describe("x402 Seller Handler", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  // Test 1: No payment header → 402 with correct payment spec shape
  it("returns 402 with correct payment spec when no x-payment header", async () => {
    delete process.env.MOCK_X402;
    const { handleRequest } = await import("../src/handler");

    const result = await handleRequest("/data/defi-protocols", undefined, () => {});

    expect(result.statusCode).toBe(402);
    const body = JSON.parse(result.body);
    expect(body.x402Version).toBe(1);
    expect(Array.isArray(body.accepts)).toBe(true);
    expect(body.accepts[0].scheme).toBe("exact");
    expect(body.accepts[0].asset).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
    expect(typeof body.accepts[0].payTo).toBe("string");
    expect(typeof body.accepts[0].maxAmountRequired).toBe("string");
  });

  // Test 2: Invalid payment header → 402 again
  it("returns 402 when payment header is present but invalid", async () => {
    delete process.env.MOCK_X402;

    // Mock the facilitator to return invalid
    vi.mock("../src/facilitator", () => ({
      verifyPayment: vi.fn().mockResolvedValue({ isValid: false, invalidReason: "Signature invalid" }),
    }));

    const { handleRequest } = await import("../src/handler");
    const result = await handleRequest("/data/defi-protocols", "invalid-payment-header", () => {});

    expect(result.statusCode).toBe(402);
  });

  // Test 3: MOCK_X402=true → 200 with data array of 5 protocols
  it("returns 200 with 5 protocols when MOCK_X402=true", async () => {
    process.env.MOCK_X402 = "true";
    vi.resetModules();
    const { handleRequest } = await import("../src/handler");

    const result = await handleRequest("/data/defi-protocols", undefined, () => {});

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(5);
    expect(body.paymentMode).toBe("mock");
  });

  // Test 4: Payment spec structure validation
  it("validates payment spec structure correctly", async () => {
    const { isValidPaymentSpecShape, buildPaymentSpec } = await import("../src/paymentSpec");

    const spec = buildPaymentSpec("/data/defi-protocols");
    expect(isValidPaymentSpecShape(spec)).toBe(true);
    expect(isValidPaymentSpecShape({})).toBe(false);
    expect(isValidPaymentSpecShape({ x402Version: 1, accepts: [] })).toBe(false);
    expect(isValidPaymentSpecShape({ x402Version: 2, accepts: [{ payTo: "0x", maxAmountRequired: "100", asset: "0x" }] })).toBe(false);
  });

  // Test 5: S3 data fetch falls back to fixture when S3 not configured
  it("fetchDefiData returns 5 protocols from fixture when S3 not configured", async () => {
    delete process.env.S3_BUCKET_NAME;
    vi.resetModules();
    const { fetchDefiData, DEMO_DEFI_DATA } = await import("../src/defiData");

    const data = await fetchDefiData();
    expect(data).toEqual(DEMO_DEFI_DATA);
    expect(data.length).toBe(5);
    expect(data[0]).toHaveProperty("protocol");
    expect(data[0]).toHaveProperty("tvl");
    expect(data[0]).toHaveProperty("volume24h");
  });
});
