import React, { useContext, useRef, useState } from "react";

import { Form, Formik } from "formik";
import { head } from "lodash";
import { toast } from "react-toastify";
import * as Yup from "yup";

import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import { makeStyles } from "@material-ui/core/styles";
import { Grid } from "@material-ui/core";

import moment from "moment";
import { i18n } from "../../translate/i18n";

import { AuthContext } from "../../context/Auth/AuthContext";
import { campaignsApi } from "../../api/CampaignsApi";
import toastError from "../../errors/toastError";
import ConfirmationModal from "../ConfirmationModal";

import useCampaignModalData from "./useCampaignModalData";
import CampaignDataFields from "./CampaignDataFields";
import CampaignMessageTabs from "./CampaignMessageTabs";
import CampaignAttachmentInfo from "./CampaignAttachmentInfo";
import CampaignActions from "./CampaignActions";

const useStyles = makeStyles(() => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
    backgroundColor: "#fff"
  },
}));

const CampaignSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
});

const CampaignModal = ({
  open,
  onClose,
  campaignId,
  initialValues,
  onSave,
  resetPagination,
}) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { companyId } = user;

  const [attachment, setAttachment] = useState(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [messageTab, setMessageTab] = useState(0);
  const attachmentFile = useRef(null);

  const {
    campaign,
    setCampaign,
    whatsapps,
    contactLists,
    tagLists,
    files,
    campaignEditable,
    resetCampaign,
  } = useCampaignModalData({ campaignId, open, initialValues, companyId });

  const handleClose = () => {
    onClose();
    resetCampaign();
  };

  const handleAttachmentFile = (e) => {
    const file = head(e.target.files);
    if (file) {
      setAttachment(file);
    }
  };

  const handleSaveCampaign = async (values) => {
    try {
      const dataValues = {};
      Object.entries(values).forEach(([key, value]) => {
        if (key === "scheduledAt" && value !== "" && value !== null) {
          dataValues[key] = moment(value).format("YYYY-MM-DD HH:mm:ss");
        } else {
          dataValues[key] = value === "" ? null : value;
        }
      });

      if (campaignId) {
        await campaignsApi.update(campaignId, dataValues);

        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await campaignsApi.mediaUpload(campaignId, formData);
        }
        handleClose();
      } else {
        const { data } = await campaignsApi.store(dataValues);

        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await campaignsApi.mediaUpload(data.id, formData);
        }
        if (onSave) {
          onSave(data);
        }
        handleClose();
      }
      toast.success(i18n.t("campaigns.toasts.success"));
    } catch (err) {
      toastError(err);
    }
  };

  const deleteMedia = async () => {
    if (attachment) {
      setAttachment(null);
      attachmentFile.current.value = null;
    }

    if (campaign.mediaPath) {
      await campaignsApi.deleteMedia(campaign.id);
      setCampaign((prev) => ({ ...prev, mediaPath: null, mediaName: null }));
      toast.success(i18n.t("campaigns.toasts.deleted"));
    }
  };

  const cancelCampaign = async () => {
    try {
      await campaignsApi.cancel(campaign.id);
      toast.success(i18n.t("campaigns.toasts.cancel"));
      setCampaign((prev) => ({ ...prev, status: "CANCELADA" }));
      resetPagination();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const restartCampaign = async () => {
    try {
      await campaignsApi.restart(campaign.id);
      toast.success(i18n.t("campaigns.toasts.restart"));
      setCampaign((prev) => ({ ...prev, status: "EM_ANDAMENTO" }));
      resetPagination();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className={classes.root}>
      <ConfirmationModal
        title={i18n.t("campaigns.confirmationModal.deleteTitle")}
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={deleteMedia}
      >
        {i18n.t("campaigns.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">
          {campaignEditable ? (
            <>
              {campaignId
                ? `${i18n.t("campaigns.dialog.update")}`
                : `${i18n.t("campaigns.dialog.new")}`}
            </>
          ) : (
            <>{`${i18n.t("campaigns.dialog.readonly")}`}</>
          )}
        </DialogTitle>
        <div style={{ display: "none" }}>
          <input
            type="file"
            ref={attachmentFile}
            onChange={(e) => handleAttachmentFile(e)}
          />
        </div>
        <Formik
          initialValues={campaign}
          enableReinitialize={true}
          validationSchema={CampaignSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveCampaign(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ values, errors, touched, isSubmitting }) => (
            <Form>
              <DialogContent dividers>
                <Grid spacing={2} container>
                  <CampaignDataFields
                    values={values}
                    touched={touched}
                    errors={errors}
                    campaignEditable={campaignEditable}
                    contactLists={contactLists}
                    tagLists={tagLists}
                    whatsapps={whatsapps}
                    files={files}
                  />
                  <CampaignMessageTabs
                    values={values}
                    messageTab={messageTab}
                    setMessageTab={setMessageTab}
                    campaignEditable={campaignEditable}
                    status={campaign.status}
                  />
                  <CampaignAttachmentInfo
                    campaign={campaign}
                    attachment={attachment}
                    campaignEditable={campaignEditable}
                    onDelete={() => setConfirmationOpen(true)}
                  />
                </Grid>
              </DialogContent>
              <CampaignActions
                campaign={campaign}
                campaignEditable={campaignEditable}
                campaignId={campaignId}
                attachment={attachment}
                isSubmitting={isSubmitting}
                onRestart={() => restartCampaign()}
                onCancel={() => cancelCampaign()}
                onAttach={() => attachmentFile.current.click()}
                onClose={handleClose}
              />
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default CampaignModal;
