import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  AutoIncrement
} from "sequelize-typescript";

import { appConfig } from "../../../config/AppConfig";
import Company from "../../companies/models/Company";
import User from "../../users/models/User";

@Table
class QuickMessage extends Model<QuickMessage> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  shortcode: string;

  @Column
  message: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => User)
  user: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @Column
  get mediaPath(): string | null {
    if (this.getDataValue("mediaPath")) {
      return `${appConfig.server.backendUrl}${
        appConfig.server.proxyPort ? `:${appConfig.server.proxyPort}` : ""
      }/public/quickMessage/${this.getDataValue("mediaPath")}`;
    }
    return null;
  }

  @Column
  mediaName: string;
}

export default QuickMessage;
