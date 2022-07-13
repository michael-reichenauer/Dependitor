import React from "react";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import DialogTitle from "@material-ui/core/DialogTitle";
import { atom, useAtom } from "jotai";

const alertAtom = atom(null);
let setAlertFunc: any = null;

export interface AlertProperties {
  onOk?: () => void;
  onCancel?: () => void;
  showOk?: boolean;
  showCancel?: boolean;
  okText?: string;
  cancelText?: string;
}

const defaultProperties: AlertProperties = {
  onOk: undefined,
  onCancel: undefined,
  showOk: true,
  showCancel: false,
  okText: "OK",
  cancelText: "Cancel",
};
export const showAlert = (
  title: string,
  message: string,
  properties?: AlertProperties
) =>
  setAlertFunc?.({
    title: title,
    message: message,
    ...defaultProperties,
    ...properties,
  });

// // Show a confirm (ok/cancel) alert
// export const showConfirmAlert = (
//   title: string,
//   message: string,
//   onOk?: () => void,
//   onCancel?: () => void
// ) =>
//   setAlertFunc?.({
//     title: title,
//     message: message,
//     onOk: onOk,
//     onCancel: onCancel,
//     confirm: true,
//   });

// // Shows a OK alert
// export const showNoOKAlert = (title: string, message: string) =>
//   setAlertFunc?.({
//     title: title,
//     message: message,
//     onOk: null,
//     confirm: false,
//   });

// // Shows a OK alert
// export const showOKAlert = (
//   title: string,
//   message: string,
//   onOk: () => void = () => {}
// ) =>
//   setAlertFunc?.({
//     title: title,
//     message: message,
//     onOk: onOk,
//     confirm: false,
//   });

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

  const showCancel =
    alert?.showCancel || alert?.onCancel || alert?.cancelText !== "Cancel";

  return (
    <Dialog open={!!alert} onClose={() => {}}>
      <DialogTitle>{alert?.title}</DialogTitle>
      <DialogContent style={{ minWidth: 300 }}>
        <DialogContentText>{alert?.message}</DialogContentText>
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
        {showCancel && (
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
