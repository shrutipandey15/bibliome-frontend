import { describe, it, expect } from "vitest";
import { titleCase } from "./titleCase";

describe("titleCase", () => {
  it("cases typed titles, keeping small words low", () => {
    expect(titleCase("the trial")).toBe("The Trial");
    expect(titleCase("Gone girl")).toBe("Gone Girl");
    expect(titleCase("the bell jar")).toBe("The Bell Jar");
    expect(titleCase("a court of thorns and roses")).toBe("A Court of Thorns and Roses");
    expect(titleCase("what it is to")).toBe("What It Is To");
  });
  it("leaves words that already carry a capital alone", () => {
    expect(titleCase("A Court of Thorns and Roses")).toBe("A Court of Thorns and Roses");
    expect(titleCase("the iPhone diaries")).toBe("The iPhone Diaries");
    expect(titleCase("1984")).toBe("1984");
  });
});
