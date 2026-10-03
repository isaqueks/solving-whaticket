// Os models puxam a conexão do sequelize: entram por factory para o teste
// rodar isolado (só a função pura normalizeSkipMenuAfterHumanHours é testada).
jest.mock("../../../models/Whatsapp", () => ({}));
jest.mock("../../../models/Company", () => ({}));
jest.mock("../../../models/Plan", () => ({}));
jest.mock("../AssociateWhatsappQueue", () => jest.fn());

import {
  MAX_SKIP_MENU_AFTER_HUMAN_HOURS,
  normalizeSkipMenuAfterHumanHours
} from "../CreateWhatsAppService";

describe("normalizeSkipMenuAfterHumanHours", () => {
  it("o limite é de 10 anos", () => {
    expect(MAX_SKIP_MENU_AFTER_HUMAN_HOURS).toBe(87600);
  });

  it.each<[unknown, number]>([
    [24, 24],
    ["24", 24],
    [" 24 ", 24],
    [1, 1],
    [87600, 87600],
    // valores enormes ("sempre") ficam no limite, não viram 0
    [87601, 87600],
    [99999999, 87600],
    [2147483647, 87600],
    [2147483648, 87600],
    [1e21, 87600],
    // 0, vazio e inválidos desligam a regra
    [0, 0],
    ["0", 0],
    ["", 0],
    ["   ", 0],
    [null, 0],
    [undefined, 0],
    [-5, 0],
    [1.5, 0],
    ["1.5", 0],
    ["abc", 0],
    [NaN, 0],
    [Infinity, 0],
    [true, 0]
  ])("normalizeSkipMenuAfterHumanHours(%p) === %p", (input, expected) => {
    expect(normalizeSkipMenuAfterHumanHours(input)).toBe(expected);
  });
});
