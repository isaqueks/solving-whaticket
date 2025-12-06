import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Remove índice único antigo baseado em participantNumber
    await queryInterface.removeIndex(
      "GroupParticipants",
      "idx_groupParticipants_participant_group"
    );

    // Adiciona nova coluna participantContactId
    await queryInterface.addColumn("GroupParticipants", "participantContactId", {
      type: DataTypes.INTEGER,
      references: { model: "Contacts", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      allowNull: true // Temporariamente nullable para migração de dados existentes
    });

    // Remove colunas antigas
    await queryInterface.removeColumn("GroupParticipants", "participantNumber");
    await queryInterface.removeColumn("GroupParticipants", "participantName");
    await queryInterface.removeColumn("GroupParticipants", "profilePicUrl");

    // Torna participantContactId obrigatório após remover dados antigos
    await queryInterface.changeColumn("GroupParticipants", "participantContactId", {
      type: DataTypes.INTEGER,
      references: { model: "Contacts", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      allowNull: false
    });

    // Cria novo índice único para (groupContactId, participantContactId)
    await queryInterface.addIndex("GroupParticipants", ["groupContactId", "participantContactId"], {
      name: "idx_groupParticipants_group_participant",
      unique: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    // Remove índice único novo
    await queryInterface.removeIndex(
      "GroupParticipants",
      "idx_groupParticipants_group_participant"
    );

    // Remove coluna participantContactId
    await queryInterface.removeColumn("GroupParticipants", "participantContactId");

    // Adiciona colunas antigas de volta
    await queryInterface.addColumn("GroupParticipants", "participantNumber", {
      type: DataTypes.STRING,
      allowNull: false
    });

    await queryInterface.addColumn("GroupParticipants", "participantName", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("GroupParticipants", "profilePicUrl", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: ""
    });

    // Recria índice antigo
    await queryInterface.addIndex("GroupParticipants", ["participantNumber", "groupContactId"], {
      name: "idx_groupParticipants_participant_group",
      unique: true
    });
  }
};

