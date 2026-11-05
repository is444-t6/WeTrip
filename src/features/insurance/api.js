import { createClient } from "../../lib/http";

const { call } = createClient({
  base:
    import.meta.env.VITE_INSURANCE_API_BASE ||
    "https://smuedu-dev.outsystemsenterprise.com/WeTrip_Insurance_Composite/rest/InsuranceAPI",

  apiKey: import.meta.env.VITE_INSURANCE_API_KEY || import.meta.env.VITE_FAMILY_API_KEY,

  auth: "header",
  normalize: true,
});

function extractBenefits(response) {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== "object") {
    throw new Error("The insurance benefits endpoint returned an unsupported response.");
  }

  for (const field of ["benefits", "items", "list", "records", "results"]) {
    if (Array.isArray(response[field])) return response[field];
  }

  const arrays = [];
  function collectArrays(value) {
    if (Array.isArray(value)) {
      arrays.push(value);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(collectArrays);
    }
  }
  collectArrays(response);
  if (arrays.length === 1) return arrays[0];
  if (arrays.length > 1) {
    throw new Error("The insurance benefits endpoint returned multiple unrecognized lists.");
  }

  const isBenefitRecord = ["name", "benefitName", "title", "coverageBenefit", "benefit"].some(
    (field) => response[field] != null,
  );
  if (isBenefitRecord) return [response];
  throw new Error("The insurance benefits endpoint returned an unsupported response.");
}

export const insuranceApi = {
  getPlans: async () => {
    const response = await call("GET", "Plans");

    console.log("Insurance Plans API response:", response);

    const plans = Array.isArray(response) ? response : (response.plans ?? response.Plans ?? []);

    return Array.isArray(plans) ? plans : [];
  },

  getQuote: (body) => call("POST", "Quote", body),

  purchase: (body) => call("POST", "Purchase", body),

  getBenefits: async (insurancePlanId) => {
    const response = await call(
      "GET",
      `Benefits?InsurancePlanId=${encodeURIComponent(insurancePlanId)}`,
    );
    const benefits = extractBenefits(response);
    if (
      !benefits ||
      benefits.some(
        (benefit) =>
          typeof benefit !== "string" &&
          (!benefit || typeof benefit !== "object" || Array.isArray(benefit)),
      )
    ) {
      throw new Error("The insurance benefits endpoint returned an unsupported response.");
    }
    return benefits;
  },

  getMyInsurance: () => call("GET", "MyInsurance"),
};

export const InsuranceApi = insuranceApi;
