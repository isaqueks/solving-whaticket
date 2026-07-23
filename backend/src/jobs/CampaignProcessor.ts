import { Job } from "bull";

import { campaignDispatchService } from "../modules/campaigns/CampaignDispatchService";
import {
  DispatchCampaignJobData,
  PrepareContactJobData,
  ProcessCampaignJobData
} from "../modules/campaigns/dtos/CampaignJobData";

/**
 * Processor Bull FINO da CampaignQueue: parse do job → método do
 * `CampaignDispatchService` (onde vive a lógica do antigo
 * queues/campaignJobs.ts). Mesmos nomes de job; handlers são arrow
 * properties para serem passados direto ao `queue.process`.
 */
export class CampaignProcessor {
  public verifyCampaigns = async (job: Job): Promise<void> => {
    await campaignDispatchService.verifyCampaigns();
  };

  public processCampaign = async (job: Job): Promise<void> => {
    await campaignDispatchService.processCampaign(
      job.data as ProcessCampaignJobData
    );
  };

  public prepareContact = async (job: Job): Promise<void> => {
    await campaignDispatchService.prepareContact(
      job.data as PrepareContactJobData
    );
  };

  public dispatchCampaign = async (job: Job): Promise<void> => {
    await campaignDispatchService.dispatchCampaign(
      job.data as DispatchCampaignJobData
    );
  };
}

export const campaignProcessor = new CampaignProcessor();
