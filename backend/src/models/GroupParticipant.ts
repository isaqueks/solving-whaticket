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
  AllowNull,
  Default,
  Index
} from "sequelize-typescript";
import Contact from "./Contact";
import Company from "./Company";

@Table
class GroupParticipant extends Model<GroupParticipant> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Contact)
  @Column
  groupContactId: number;

  @BelongsTo(() => Contact)
  groupContact: Contact;

  @Column
  participantNumber: string;

  @AllowNull(true)
  @Column
  participantName: string;

  @Default(false)
  @Column
  isAdmin: boolean;

  @Default(false)
  @Column
  isSuperAdmin: boolean;

  @AllowNull(true)
  @Default("")
  @Column
  profilePicUrl: string;

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

