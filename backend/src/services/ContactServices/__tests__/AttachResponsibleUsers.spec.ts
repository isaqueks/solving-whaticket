// Os models puxam a conexão do sequelize: entram por mock para o teste rodar
// isolado. Só o User.findAll é usado pelo helper.
const findAll = jest.fn();
jest.mock("../../../models/Contact", () => ({}));
jest.mock("../../../models/User", () => ({ findAll: (...args: any[]) => findAll(...args) }));

import AttachResponsibleUsers from "../AttachResponsibleUsers";

// contato mínimo: só o que o helper lê/escreve
const makeContact = (attachedToEmail: string | null) => {
  const dataValues: Record<string, unknown> = {};
  return {
    attachedToEmail,
    dataValues,
    setDataValue: (key: string, value: unknown) => {
      dataValues[key] = value;
    }
  } as any;
};

describe("AttachResponsibleUsers", () => {
  it("não consulta usuários quando nenhum contato tem responsável", async () => {
    const contacts = [makeContact(null), makeContact(""), undefined];

    await AttachResponsibleUsers(contacts, 2);

    expect(findAll).not.toHaveBeenCalled();
    expect(contacts[0].dataValues.attachedUser).toBeNull();
    expect(contacts[1].dataValues.attachedUser).toBeNull();
  });

  it("resolve o responsável por e-mail, sem distinguir maiúsculas, em uma consulta", async () => {
    findAll.mockResolvedValue([
      { id: 7, name: "Ana", email: "Ana@Empresa.com" },
      { id: 9, name: "Bia", email: "bia@empresa.com" }
    ]);
    const ana = makeContact("ana@empresa.com");
    const anaUpper = makeContact(" ANA@EMPRESA.COM ");
    const bia = makeContact("bia@empresa.com");
    const semUsuario = makeContact("ninguem@empresa.com");
    const semResponsavel = makeContact(null);

    await AttachResponsibleUsers([ana, anaUpper, bia, semUsuario, semResponsavel], 2);

    expect(findAll).toHaveBeenCalledTimes(1);
    expect(findAll.mock.calls[0][0].where.companyId).toBe(2);
    expect(ana.dataValues.attachedUser).toEqual({ id: 7, name: "Ana", email: "Ana@Empresa.com" });
    expect(anaUpper.dataValues.attachedUser).toEqual({ id: 7, name: "Ana", email: "Ana@Empresa.com" });
    expect(bia.dataValues.attachedUser).toEqual({ id: 9, name: "Bia", email: "bia@empresa.com" });
    expect(semUsuario.dataValues.attachedUser).toBeNull();
    expect(semResponsavel.dataValues.attachedUser).toBeNull();
  });
});
