import { Router } from "express";

import userRoutes from "../modules/users/users.routes";
import authRoutes from "../modules/auth/auth.routes";
import settingRoutes from "../modules/settings/settings.routes";
import contactRoutes from "../modules/contacts/contacts.routes";
import ticketRoutes from "../modules/tickets/tickets.routes";
import whatsappRoutes from "../modules/whatsapp/whatsapp.routes";
import messageRoutes from "../modules/messages/messages.routes";
import whatsappSessionRoutes from "../modules/whatsapp-session/whatsapp-session.routes";
import queueRoutes from "../modules/queues/queues.routes";
import companyRoutes from "../modules/companies/companies.routes";
import planRoutes from "../modules/plans/plans.routes";
import ticketNoteRoutes from "../modules/ticket-notes/ticket-notes.routes";
import quickMessageRoutes from "../modules/quick-messages/quick-messages.routes";
import helpRoutes from "../modules/help/help.routes";
import reportsRoutes from "../modules/reports/reports.routes";
import scheduleRoutes from "../modules/schedules/schedules.routes";
import tagRoutes from "../modules/tags/tags.routes";
import contactListRoutes from "../modules/contact-lists/contact-lists.routes";
import campaignRoutes from "../modules/campaigns/campaigns.routes";
import announcementRoutes from "../modules/announcements/announcements.routes";
import chatRoutes from "../modules/chat/chat.routes";
import filesRoutes from "../modules/files/files.routes";
import queueIntegrationRoutes from "../modules/queue-integrations/queue-integrations.routes";
import forgotsRoutes from "../modules/forgot-password/forgot-password.routes";
import versionRoutes from "../modules/version/version.routes";
import webhookRoutes from "../modules/contacts/contacts-webhook.routes";
import publicMessageRoutes from "../modules/messages/public-messages.routes";
import groupParticipantRoutes from "../modules/group-participants/group-participants.routes";
const routes = Router();

routes.use(userRoutes);
routes.use("/auth", authRoutes);
routes.use("/webhook", webhookRoutes);
routes.use(settingRoutes);
routes.use(contactRoutes);
routes.use(ticketRoutes);
routes.use(whatsappRoutes);
routes.use(messageRoutes);
routes.use(whatsappSessionRoutes);
routes.use(queueRoutes);
routes.use(companyRoutes);
routes.use(planRoutes);
routes.use(ticketNoteRoutes);
routes.use(quickMessageRoutes);
routes.use(helpRoutes);
routes.use(reportsRoutes);
routes.use(scheduleRoutes);
routes.use(tagRoutes);
routes.use(contactListRoutes);
routes.use(campaignRoutes);
routes.use(announcementRoutes);
routes.use(chatRoutes);
routes.use(filesRoutes);
routes.use(queueIntegrationRoutes);
routes.use(forgotsRoutes);
routes.use(versionRoutes);
// POST /integrationRoutes agora vive em queue-integrations.routes.
routes.use(publicMessageRoutes);
routes.use(groupParticipantRoutes);

// GET /ticket-by-number e GET /fixTickets agora vivem em tickets.routes.

export default routes;
