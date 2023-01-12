import React, { FC } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import InfoIcon from "@mui/icons-material/Info";
import ErrorIcon from "@mui/icons-material/Error";
import HelpIcon from "@mui/icons-material/Help";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { atom, useAtom } from "jotai";
import { Box } from "@mui/material";
import { blue, green, red, yellow } from "@mui/material/colors";

const alertAtom = atom(null);
let setAlertFunc: any = null;

type AlertIcon = string;

const InfoAlert: AlertIcon = "info";
const SuccessAlert: AlertIcon = "success";
const ErrorAlert: AlertIcon = "error";
const WarningAlert: AlertIcon = "warning";
const QuestionAlert: AlertIcon = "question";

export interface AlertOptions {
  // onOk?: () => void;
  // onCancel?: () => void;
  showOk?: boolean;
  showCancel?: boolean;
  okText?: string;
  cancelText?: string;
  // icon?: AlertIcon;
}

interface AlertOptionsImpl extends AlertOptions {
  title: string;
  message: string;
  onOk?: () => void;
  onCancel?: () => void;
  icon?: AlertIcon;
}

const defaultOptions: AlertOptions = {
  // onOk: undefined,
  // onCancel: undefined,
  showOk: true,
  showCancel: false,
  okText: "OK",
  cancelText: "Cancel",
  //  icon: InfoAlert,
};

export function showInfoAlert(
  title: string,
  message: string,
  options: AlertOptions
): Promise<boolean> {
  return showAlert(title, message, InfoAlert, options);
}

export function showSuccessAlert(
  title: string,
  message: string,
  options?: AlertOptions
): Promise<boolean> {
  return showAlert(title, message, SuccessAlert, options);
}

export function showErrorAlert(
  title: string,
  message: string,
  options?: AlertOptions
): Promise<boolean> {
  return showAlert(title, message, ErrorAlert, options);
}
export function showWarningAlert(
  title: string,
  message: string,
  options?: AlertOptions
): Promise<boolean> {
  return showAlert(title, message, WarningAlert, options);
}
export function showQuestionAlert(
  title: string,
  message: string,
  options?: AlertOptions
): Promise<boolean> {
  const opt = { showCancel: true, ...options };
  return showAlert(title, message, QuestionAlert, opt);
}

function showAlert(
  title: string,
  message: string,
  icon: AlertIcon,
  options?: AlertOptions
): Promise<boolean> {
  const showCancel = options?.showCancel || !!options?.cancelText;
  const alertOptions: AlertOptionsImpl = {
    title: title,
    message: message,
    ...defaultOptions,
    ...options,
    showCancel: showCancel,
    icon: icon,
  };
  // const onOk = alertOptions.onOk;
  // const onCancel = alertOptions.onCancel;

  const promise = new Promise<boolean>((resolve) => {
    alertOptions.onOk = () => resolve(true);
    alertOptions.onCancel = () => resolve(false);
  });
  setAlertFunc?.(alertOptions);
  return promise;
}

// Use alert for OK/cancel or just OK
export const useAlert = (): [any, any] => {
  const [alert, setAlert] = useAtom(alertAtom);
  if (setAlertFunc == null) {
    setAlertFunc = setAlert;
  }

  return [alert, setAlert];
};

export default function AlertDialog() {
  const [alert, setAlert] = useAlert();

  const handleCancel = () => {
    setAlert?.(null);
    // @ts-ignore
    alert?.onCancel?.();
  };

  const handleOK = () => {
    setAlert?.(null);
    // @ts-ignore
    alert?.onOk?.();
  };

  return (
    <Dialog open={!!alert} onClose={() => { }}>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <Box>
            <Icon alert={alert} />
          </Box>
          <Box flexGrow={1} style={{ marginLeft: 10, marginTop: -10 }}>
            {alert?.title}
          </Box>
        </Box>
      </DialogTitle>

      {/* <DialogTitle>{alert?.title}</DialogTitle> */}

      <DialogContent style={{ minWidth: 300 }}>
        <DialogContentText style={{ whiteSpace: "pre-line" }}>
          {alert?.message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        {alert?.showOk && (
          <Button
            onClick={handleOK}
            color="primary"
            autoFocus
            variant="contained"
            style={{ margin: 5, width: 85 }}
          >
            {alert?.okText}
          </Button>
        )}
        {alert?.showCancel && (
          <Button
            onClick={handleCancel}
            color="primary"
            variant="contained"
            style={{ margin: 5, width: 85 }}
          >
            {alert?.cancelText}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

type IconProps = {
  alert: AlertOptionsImpl;
};

const Icon: FC<IconProps> = ({ alert }) => {
  if (alert?.icon === SuccessAlert) {
    return (
      <CheckCircleIcon
        style={{ color: green[900], marginLeft: -5 }}
        fontSize="large"
      />
    );
  }
  if (alert?.icon === QuestionAlert) {
    return (
      <HelpIcon style={{ color: blue[800], marginLeft: -5 }} fontSize="large" />
    );
  }
  if (alert?.icon === ErrorAlert) {
    return (
      <ErrorIcon style={{ color: red[900], marginLeft: -5 }} fontSize="large" />
    );
  }
  if (alert?.icon === WarningAlert) {
    return (
      <WarningIcon
        style={{ color: yellow[900], marginLeft: -5 }}
        fontSize="large"
      />
    );
  }

  return (
    <InfoIcon style={{ color: blue[800], marginLeft: -5 }} fontSize="large" />
  );
};
