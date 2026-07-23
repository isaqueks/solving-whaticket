import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  Default
} from "sequelize-typescript";
import Contact from "../../contacts/models/Contact";
import Company from "../../companies/models/Company";

@Table
class GroupParticipant extends Model<GroupParticipant> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Contact)
  @Column
  groupContactId: number;

  @BelongsTo(() => Contact, "groupContactId")
  groupContact: Contact;

  @ForeignKey(() => Contact)
  @Column
  participantContactId: number;

  @BelongsTo(() => Contact, "participantContactId")
  participantContact: Contact;

  @Default(false)
  @Column
  isAdmin: boolean;

  @Default(false)
  @Column
  isSuperAdmin: boolean;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default GroupParticipant;
