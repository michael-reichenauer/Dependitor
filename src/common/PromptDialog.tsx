import React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import TextField from "@mui/material/TextField";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { atom, useAtom } from "jotai";
import { makeStyles } from "@mui/styles";

const promptAtom = atom(null);
let setPromptFunc: any = null;

const useStyles = makeStyles((_theme) => ({
  topScrollPaper: {
    alignItems: "flex-start",
  },
  topPaperScrollBody: {
    verticalAlign: "top",
  },
}));

// Show a prompt (ok/cancel)
export const showPrompt = (
  title: string,
  message: string,
  text: string,
  onOk?: (msg: string) => void,
  onCancel?: () => void
) =>
  setPromptFunc?.({
    title: title,
    message: message,
    text: text,
    onOk: onOk,
    onCancel: onCancel,
    confirm: true,
  });

// Use prompt for OK/cancel or just OK
export const usePrompt = (): any => {
  const [prompt, setPrompt] = useAtom(promptAtom);
  if (setPromptFunc == null) {
    setPromptFunc = setPrompt;
  }

  return [prompt, setPrompt];
};

export default function PromptDialog() {
  const classes = useStyles();
  const [prompt, setPrompt] = usePrompt();

  const handleCancel = () => {
    setPrompt?.(null);
    prompt?.onCancel?.();
  };

  const handleOK = () => {
    setPrompt?.(null);
    prompt?.onOk?.(prompt.text);
  };

  const handleTextFieldChange = (e: any) => {
    setPrompt?.({ ...prompt, text: e.target.value });
  };

  const catchReturn = (ev: any) => {
    if (ev.key === "Enter") {
      handleOK();
      ev.preventDefault();
    }
  };

  return (
    <Dialog
      open={!!prompt}
      onClose={handleCancel}
      classes={{
        scrollPaper: classes.topScrollPaper,
        paperScrollBody: classes.topPaperScrollBody,
      }}
    >
      <DialogTitle>{prompt?.title}</DialogTitle>
      <DialogContent style={{ minWidth: 300 }}>
        {prompt?.message && (
          <DialogContentText>{prompt?.message}</DialogContentText>
        )}

        <TextField
          autoFocus
          id="name"
          label="Name"
          fullWidth
          variant="standard"
          defaultValue={prompt?.text ?? ""}
          onChange={handleTextFieldChange}
          onKeyPress={catchReturn}
        />
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handleOK}
          color="primary"
          variant="contained"
          style={{ margin: 5, width: 85 }}
        >
          OK
        </Button>
        {prompt?.confirm && (
          <Button
            onClick={handleCancel}
            color="primary"
            variant="contained"
            style={{ margin: 5, width: 85 }}
          >
            Cancel
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
