import React, { useState, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form } from "formik";
import { toast } from "react-toastify";
import { head } from "lodash";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";

import { queuesApi } from "../../api/QueuesApi";
import toastError from "../../errors/toastError";
import {
  Paper,
  Tab,
  Tabs,
} from "@material-ui/core";
import { QueueOptions } from "../QueueOptions";
import ConfirmationModal from "../ConfirmationModal";

import useQueueModalData from "./useQueueModalData";
import QueueDataFields from "./QueueDataFields";
import QueueAttachmentInfo from "./QueueAttachmentInfo";
import QueueSchedulesTab from "./QueueSchedulesTab";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },

  btnWrapper: {
    position: "relative",
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
}));

const QueueSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
  color: Yup.string().min(3, "Too Short!").max(9, "Too Long!").required(),
  greetingMessage: Yup.string(),
});

const QueueModal = ({ open, onClose, queueId }) => {
  const classes = useStyles();

  const [colorPickerModalOpen, setColorPickerModalOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [attachment, setAttachment] = useState(null);
  const attachmentFile = useRef(null);
  const greetingRef = useRef();
  const [queueEditable, setQueueEditable] = useState(true);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const {
    queue,
    setQueue,
    schedules,
    setSchedules,
    schedulesEnabled,
    integrations,
    resetQueue,
  } = useQueueModalData({ queueId, open });

  const handleClose = () => {
    onClose();
    resetQueue();
  };

  const handleAttachmentFile = (e) => {
    const file = head(e.target.files);
    if (file) {
      setAttachment(file);
    }
  };


  const deleteMedia = async () => {
    if (attachment) {
      setAttachment(null);
      attachmentFile.current.value = null;
    }

    if (queue.mediaPath) {
      await queuesApi.deleteMedia(queue.id);
      setQueue((prev) => ({ ...prev, mediaPath: null, mediaName: null }));
      toast.success(i18n.t("queueModal.toasts.deleted"));
    }
  };

  const handleSaveQueue = async (values) => {
    try {
      if (queueId) {
        await queuesApi.update(queueId, {
          ...values, schedules
        });
		if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await queuesApi.mediaUpload(queueId, formData);
        }
      } else {
        await queuesApi.store({
          ...values, schedules
        });
		if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await queuesApi.mediaUpload(queueId, formData);
      }
	  }
      toast.success("Queue saved successfully");
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  const handleSaveSchedules = async (values) => {
    toast.success("Clique em salvar para registar as alterações");
    setSchedules(values);
    setTab(0);
  };

  return (
    <div className={classes.root}>
    <ConfirmationModal
        title={i18n.t("queueModal.confirmationModal.deleteTitle")}
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={deleteMedia}
      ></ConfirmationModal>
    <Dialog
    maxWidth="md"
    fullWidth={true}
    open={open}
    onClose={handleClose}
    scroll="paper"
  >
    <DialogTitle>
      {queueId
        ? `${i18n.t("queueModal.title.edit")}`
        : `${i18n.t("queueModal.title.add")}`}
       <div style={{ display: "none" }}>
        <input
          type="file"
          ref={attachmentFile}
          onChange={(e) => handleAttachmentFile(e)}
        />
      </div>
    </DialogTitle>
        <Tabs
          value={tab}
          indicatorColor="primary"
          textColor="primary"
          onChange={(_, v) => setTab(v)}
          aria-label="disabled tabs example"
        >
          <Tab label="Dados da Fila" />
          {schedulesEnabled && <Tab label="Horários de Atendimento" />}
        </Tabs>
        {tab === 0 && (
          <Paper>
            <Formik
              initialValues={queue}
              enableReinitialize={true}
              validationSchema={QueueSchema}
              onSubmit={(values, actions) => {
                setTimeout(() => {
                  handleSaveQueue(values);
                  actions.setSubmitting(false);
                }, 400);
              }}
            >
              {({ touched, errors, isSubmitting, values }) => (
                <Form>
                  <DialogContent dividers>
                    <QueueDataFields
                      values={values}
                      touched={touched}
                      errors={errors}
                      integrations={integrations}
                      schedulesEnabled={schedulesEnabled}
                      colorPickerModalOpen={colorPickerModalOpen}
                      setColorPickerModalOpen={setColorPickerModalOpen}
                      greetingRef={greetingRef}
                      setQueue={setQueue}
                    />
                    <QueueOptions queueId={queueId} />
                    <QueueAttachmentInfo
                      queue={queue}
                      attachment={attachment}
                      queueEditable={queueEditable}
                      onDelete={() => setConfirmationOpen(true)}
                    />
                  </DialogContent>
                  <DialogActions>
                  {!attachment && !queue.mediaPath && queueEditable && (
                    <Button
                      color="primary"
                      onClick={() => attachmentFile.current.click()}
                      disabled={isSubmitting}
                      variant="outlined"
                    >
                      {i18n.t("queueModal.buttons.attach")}
                    </Button>
                  )}
                    <Button
                      onClick={handleClose}
                      color="secondary"
                      disabled={isSubmitting}
                      variant="outlined"
                    >
                      {i18n.t("queueModal.buttons.cancel")}
                    </Button>
                    <Button
                      type="submit"
                      color="primary"
                      disabled={isSubmitting}
                      variant="contained"
                      className={classes.btnWrapper}
                    >
                      {queueId
                        ? `${i18n.t("queueModal.buttons.okEdit")}`
                        : `${i18n.t("queueModal.buttons.okAdd")}`}
                      {isSubmitting && (
                        <CircularProgress
                          size={24}
                          className={classes.buttonProgress}
                        />
                      )}
                    </Button>
                  </DialogActions>
                </Form>
              )}
            </Formik>
          </Paper>
        )}
        {tab === 1 && (
          <QueueSchedulesTab
            schedules={schedules}
            onSubmit={handleSaveSchedules}
          />
        )}
      </Dialog>
    </div>
  );
};

export default QueueModal;
