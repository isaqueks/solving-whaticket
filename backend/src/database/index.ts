import { Sequelize } from "sequelize-typescript";
import User from "../modules/users/models/User";
import Setting from "../modules/settings/models/Setting";
import Contact from "../modules/contacts/models/Contact";
import Ticket from "../modules/tickets/models/Ticket";
import Whatsapp from "../modules/whatsapp/models/Whatsapp";
import ContactCustomField from "../modules/contacts/models/ContactCustomField";
import Message from "../modules/messages/models/Message";
import Queue from "../modules/queues/models/Queue";
import WhatsappQueue from "../modules/queues/models/WhatsappQueue";
import UserQueue from "../modules/queues/models/UserQueue";
import Company from "../modules/companies/models/Company";
import Plan from "../modules/plans/models/Plan";
import TicketNote from "../modules/ticket-notes/models/TicketNote";
import QuickMessage from "../modules/quick-messages/models/QuickMessage";
import Help from "../modules/help/models/Help";
import TicketTraking from "../modules/tickets/models/TicketTraking";
import UserRating from "../modules/tickets/models/UserRating";
import QueueOption from "../modules/queues/models/QueueOption";
import Schedule from "../modules/schedules/models/Schedule";
import Tag from "../modules/tags/models/Tag";
import TicketTag from "../modules/tags/models/TicketTag";
import ContactList from "../modules/contact-lists/models/ContactList";
import ContactListItem from "../modules/contact-lists/models/ContactListItem";
import Campaign from "../modules/campaigns/models/Campaign";
import CampaignSetting from "../modules/campaigns/models/CampaignSetting";
import Baileys from "../modules/whatsapp-session/models/Baileys";
import CampaignShipping from "../modules/campaigns/models/CampaignShipping";
import Announcement from "../modules/announcements/models/Announcement";
import Chat from "../modules/chat/models/Chat";
import ChatUser from "../modules/chat/models/ChatUser";
import ChatMessage from "../modules/chat/models/ChatMessage";
import BaileysChats from "../modules/whatsapp-session/models/BaileysChats";
import Files from "../modules/files/models/Files";
import FilesOptions from "../modules/files/models/FilesOptions";
import QueueIntegrations from "../modules/queue-integrations/models/QueueIntegrations";
import GroupParticipant from "../modules/group-participants/models/GroupParticipant";

// eslint-disable-next-line
const dbConfig = require("../config/database");
// import dbConfig from "../config/database";

const sequelize = new Sequelize(dbConfig);

const models = [
  Company,
  User,
  Contact,
  Ticket,
  Message,
  Whatsapp,
  ContactCustomField,
  Setting,
  Queue,
  WhatsappQueue,
  UserQueue,
  Plan,
  TicketNote,
  QuickMessage,
  Help,
  TicketTraking,
  UserRating,
  QueueOption,
  Schedule,
  Tag,
  TicketTag,
  ContactList,
  ContactListItem,
  Campaign,
  CampaignSetting,
  Baileys,
  CampaignShipping,
  Announcement,
  Chat,
  ChatUser,
  ChatMessage,
  BaileysChats,
  Files,
  FilesOptions,
  QueueIntegrations,
  GroupParticipant,
];

sequelize.addModels(models);

export default sequelize;
