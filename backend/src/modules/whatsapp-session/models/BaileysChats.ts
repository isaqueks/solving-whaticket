import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  Default,
  ForeignKey,
  DataType,
  AllowNull,
  AutoIncrement
} from "sequelize-typescript";
import Whatsapp from "../../whatsapp/models/Whatsapp";

@Table
class BaileysChats extends Model<BaileysChats> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  jid: string;

  @Column
  conversationTimestamp: number;

  @Default(0)
  @Column
  unreadCount: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Whatsapp)
  @Column(DataType.INTEGER)
  whatsappId: string;
}

export default BaileysChats;
