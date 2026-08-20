import type { StatecraftScenario } from "../../../src/index.js";

const scenario: StatecraftScenario = {
  async beforeNavigate({ page }) {
    void page;
  },
};

export default scenario;
