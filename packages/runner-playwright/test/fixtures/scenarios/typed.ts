import type { UIWitnessScenario } from "../../../src/index.js";

const scenario: UIWitnessScenario = {
  async beforeNavigate({ page }) {
    void page;
  },
};

export default scenario;
