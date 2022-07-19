import React, { FC } from "react";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import DialogTitle from "@material-ui/core/DialogTitle";
import InfoIcon from "@material-ui/icons/Info";
import ErrorIcon from "@material-ui/icons/Error";
import HelpIcon from "@material-ui/icons/Help";
import WarningIcon from "@material-ui/icons/Warning";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import { atom, useAtom } from "jotai";
import { Box } from "@material-ui/core";
import { blue, green, red, yellow } from "@material-ui/core/colors";

const alertAtom = atom(null);
let setAlertFunc: any = null;

type AlertIcon = string;

export const InfoAlert: AlertIcon = "info";
export const SuccessAlert: AlertIcon = "success";
export const ErrorAlert: AlertIcon = "error";
export const WarningAlert: AlertIcon = "warning";
export const QuestionAlert: AlertIcon = "question";

export interface AlertProperties {
  onOk?: () => void;
  onCancel?: () => void;
  showOk?: boolean;
  showCancel?: boolean;
  okText?: string;
  cancelText?: string;
  icon?: AlertIcon;
}

const defaultProperties: AlertProperties = {
  onOk: undefined,
  onCancel: undefined,
  showOk: true,
  showCancel: false,
  okText: "OK",
  cancelText: "Cancel",
  icon: InfoAlert,
};

export const showAlert = (
  title: string,
  message: string,
  properties?: AlertProperties
) => {
  const showCancel =
    properties?.showCancel || properties?.cancelText || properties?.onCancel;
  setAlertFunc?.({
    title: title,
    message: message,
    ...defaultProperties,
    ...properties,
    showCancel: showCancel,
  });
};

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
    <Dialog open={!!alert} onClose={() => {}}>
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
  alert: AlertProperties;
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
