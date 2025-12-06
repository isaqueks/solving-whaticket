import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("GroupParticipants", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      groupContactId: {
        type: DataTypes.INTEGER,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      participantNumber: {
        type: DataTypes.STRING,
        allowNull: false
      },
      participantName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      isSuperAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      profilePicUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: ""
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    }).then(() => {
      return queryInterface.addIndex("GroupParticipants", ["groupContactId"], {
        name: "idx_groupParticipants_groupContactId"
      });
    }).then(() => {
      return queryInterface.addIndex("GroupParticipants", ["participantNumber", "groupContactId"], {
        name: "idx_groupParticipants_participant_group",
        unique: true
      });
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("GroupParticipants");
  }
};

