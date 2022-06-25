import React, { FC, useRef } from "react";
import PubSub from "pubsub-js";
import {
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Tooltip,
  Box,
} from "@material-ui/core";

import makeStyles from "@material-ui/core/styles/makeStyles";
import { ApplicationMenu } from "./ApplicationMenu";
import AddBoxOutlinedIcon from "@material-ui/icons/AddBoxOutlined";

import SyncIcon from "@material-ui/icons/Sync";
import SyncProblemIcon from "@material-ui/icons/SyncProblem";
import SyncDisabledIcon from "@material-ui/icons/SyncDisabled";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import UndoIcon from "@material-ui/icons/Undo";
import RedoIcon from "@material-ui/icons/Redo";
import FilterCenterFocusIcon from "@material-ui/icons/FilterCenterFocus";

import { useCanRedo, useCanUndo, useTitle } from "./Diagram";
import { IOnlineKey, SyncState, useSyncMode } from "./Online";
import { showPrompt } from "./../common/PromptDialog";
import { di } from "../common/di";
import { IAuthenticate, IAuthenticateKey } from "../common/authenticate";
//import { bufferToBase64, sha256Hash } from "../common/utils";
import {
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { isError } from "../common/Result";
import { sha256Hash } from "../common/utils";

type ApplicationBarProps = {
  height: number;
};

// const randomStringFromServer = "1234512345";
// const userId = "user1";
// const username = "user_1";=
// const userDisplayName = "user 1";

const usernameOrg = "michael";

const register = async () => {
  console.log("register");
  const authenticate: IAuthenticate = di(IAuthenticateKey);

  const isAvailable = await platformAuthenticatorIsAvailable();
  console.log("platformAuthenticatorIsAvailable", isAvailable);
  if (!isAvailable) {
    alert("Error: Biometrics not available");
    return;
  }

  const usernameSha = await sha256Hash(usernameOrg);

  const registrationOptions = await authenticate.getWebAuthnRegistrationOptions(
    {
      username: usernameSha,
    }
  );
  if (isError(registrationOptions)) {
    console.error("error", registrationOptions);
    alert(
      "Error: Failed to get registration options from server" +
        registrationOptions
    );
    return;
  }

  console.log("options", registrationOptions);
  const options: any = registrationOptions;
  options.user.id = "12345" + options.user.id;
  options.user.name = usernameOrg;

  let registration;
  try {
    // Pass the options to the authenticator and wait for a response
    registration = await startRegistration(options);
  } catch (error) {
    // Some basic error handling
    const e = error as Error;
    console.error("Error", error);
    console.error("name", e.name);
    alert("Error: Failed to register on device" + error);
    // if (error.name === 'InvalidStateError') {
    //   elemError.innerText = 'Error: Authenticator was probably already registered by user';
    // } else {
    //   elemError.innerText = error;
    // }

    return;
  }
  console.log("registrationResponse", registration);

  const verification = await authenticate.verifyWebAuthnRegistration({
    username: usernameSha,
    registration: registration,
  });
  if (isError(verification)) {
    console.error("error", verification);
    alert("Error: Failed to verify registration on server" + verification);
    return;
  }

  if (!(verification as any).verified) {
    console.error("Failed to verify registration on server", verification);
    alert("Error: Failed to verify registration on server: " + verification);
    return;
  }

  console.log("verified registration", verification);
  alert("Registration verified by server: " + (verification as any).verified);
};

const verify = async () => {
  console.log("verify");
  const authenticate: IAuthenticate = di(IAuthenticateKey);
  const usernameSha = await sha256Hash(usernameOrg);

  // GET authentication options from the endpoint that calls
  const options = await authenticate.getWebAuthnAuthenticationOptions({
    username: usernameSha,
  });
  if (isError(options)) {
    console.error("error", options);
    alert("Error: failed to get authentication options from server");
    return;
  }
  console.log("got authentication", options);

  let authentication;
  try {
    // Pass the options to the authenticator and wait for a response
    authentication = await startAuthentication(options);
  } catch (error) {
    console.error("Error", error);
    alert("Error: Failed to authenticate on device" + error);
    return;
  }

  console.log("authentication", authentication);

  console.log(
    "useridprefix",
    authentication.response.userHandle.substring(0, 5)
  );
  authentication.response.userHandle = null;

  // POST the response to the endpoint that calls
  const verification = await authenticate.verifyWebAuthnAuthentication({
    username: usernameSha,
    authentication: authentication,
  });
  console.log("rsp", verification);

  if (isError(verification)) {
    console.error("error", verification);
    alert("Error: Failed to verify authentication on server: " + verification);
    return;
  }

  alert("Authenticated verified by server" + (verification as any).verified);
};

// const register = async () => {
//   console.log("register");

//   try {
//     const registerOptions: PublicKeyCredentialCreationOptions = {
//       challenge: Uint8Array.from(randomStringFromServer, (c) =>
//         c.charCodeAt(0)
//       ),
//       rp: {
//         name: "Dependitor",
//       },
//       user: {
//         id: Uint8Array.from(await sha256Hash(userId), (c) => c.charCodeAt(0)),
//         name: username,
//         displayName: userDisplayName,
//       },
//       pubKeyCredParams: [
//         { alg: -7, type: "public-key" },
//         { alg: -257, type: "public-key" },
//       ],

//       attestation: "none", // none to avoid personalized data
//     };

//     const credential = await navigator.credentials.create({
//       publicKey: registerOptions,
//     });
//     console.log("credential", credential);
//     credId = credential?.id ?? "";

//     // console.log("raw id", credId);
//     // var id = new TextDecoder().decode(credId);
//     // console.log("id", id);
//     // console.log(
//     //   "raw id id",
//     //   Uint8Array.from(idx, (c) => c.charCodeAt(0))
//     // );
//   } catch (error) {
//     console.error("error:", error);
//   }
// };

//let credId: string = "";
// const verify = async () => {
//   console.log("verify", credId);
//   try {
//     var options: PublicKeyCredentialRequestOptions = {
//       challenge: Uint8Array.from(randomStringFromServer, (c) =>
//         c.charCodeAt(0)
//       ),
//       timeout: 60000,
//       userVerification: "preferred",
//       // allowCredentials: [
//       //   {
//       //     id: base64ToBuffer(credId),
//       //     type: "public-key",
//       //     transports: ["internal", "usb", "ble", "nfc"],
//       //   },
//       // ],
//     };

//     const credential = (await navigator.credentials.get({
//       publicKey: options,
//       mediation: "silent",
//     })) as PublicKeyCredential;
//     const rsp = credential.response as AuthenticatorAssertionResponse;
//     console.log("credential", credential);
//     console.log("Signature", bufferToBase64(rsp.signature));

//     const utf8Decoder = new TextDecoder("utf-8");
//     const decodedClientData = utf8Decoder.decode(rsp.clientDataJSON);
//     console.log("decodedClientData", decodedClientData);

//     if (rsp.userHandle) {
//       const decodedUserhandle = utf8Decoder.decode(rsp.userHandle);
//       console.log("decodedUserhandle", decodedUserhandle);
//     }

//     // // parse the string as an object
//     // const clientDataObj = JSON.parse(decodedClientData);
//   } catch (error) {
//     console.error("error:", error);
//   }
// };

export const ApplicationBar: FC<ApplicationBarProps> = ({ height }) => {
  const onlineRef = useRef(di(IOnlineKey));
  const classes = useAppBarStyles();
  const [titleText] = useTitle();
  const syncMode = useSyncMode();
  const [canUndo] = useCanUndo();
  const [canRedo] = useCanRedo();
  // const [canPopDiagram] = useAtom(canPopDiagramAtom)

  const style = (disabled?: any) => {
    return !disabled ? classes.icons : classes.iconsDisabled;
  };

  const styleAlways = (disabled?: any) => {
    return !disabled ? classes.iconsAlways : classes.iconsAlwaysDisabled;
  };

  const renameDiagram = () => {
    var name = titleText;
    const index = titleText.lastIndexOf(" - ");
    if (index > -1) {
      name = name.substring(0, index);
    }

    showPrompt("Rename Diagram", "", name, (name) =>
      PubSub.publish("canvas.RenameDiagram", name)
    );
  };

  return (
    <AppBar position="static" style={{ height: height }}>
      <Toolbar>
        <ApplicationMenu />
        {syncMode === SyncState.Progress && (
          <Button
            tooltip={`Trying to connect, please wait`}
            icon={<HourglassEmptyIcon style={{ color: "gray" }} />}
            onClick={() => {}}
          />
        )}
        {syncMode === SyncState.Enabled && (
          <Button
            tooltip={`Device sync enabled and OK, click to sync now`}
            icon={<SyncIcon style={{ color: "Lime" }} />}
            onClick={() => onlineRef.current.enableSync()}
          />
        )}
        {syncMode === SyncState.Error && (
          <Button
            tooltip="Device sync error, click to retry sync now"
            icon={<SyncProblemIcon style={{ color: "#FF3366" }} />}
            onClick={() => onlineRef.current.enableSync()}
          />
        )}
        {syncMode === SyncState.Disabled && (
          <Button
            tooltip="Device sync disabled, click to enable"
            icon={<SyncDisabledIcon style={{ color: "#FFFF66" }} />}
            onClick={() => onlineRef.current.enableSync()}
          />
        )}

        <Button
          tooltip="Register"
          icon={<UndoIcon />}
          onClick={() => register()}
        />
        <Button tooltip="Verify" icon={<UndoIcon />} onClick={() => verify()} />

        <Button
          tooltip="Undo"
          disabled={!canUndo}
          icon={<UndoIcon className={styleAlways(!canUndo)} />}
          onClick={() => PubSub.publish("canvas.Undo")}
        />
        <Button
          tooltip="Redo"
          disabled={!canRedo}
          icon={<RedoIcon className={styleAlways(!canRedo)} />}
          onClick={() => PubSub.publish("canvas.Redo")}
        />

        <Button
          tooltip="Add node"
          icon={<AddBoxOutlinedIcon className={styleAlways()} />}
          onClick={(e) => {
            PubSub.publish("nodes.showDialog", { add: true });
          }}
        />

        <Button
          tooltip="Scroll and zoom to show all of the diagram"
          icon={<FilterCenterFocusIcon className={styleAlways()} />}
          onClick={() => PubSub.publish("canvas.ShowTotalDiagram")}
        />
        {/* <Button tooltip="Pop to surrounding diagram" disabled={!canPopDiagram} icon={<SaveAltIcon className={styleAlways(!canPopDiagram)} style={{ transform: 'rotate(180deg)' }} />}
                    onClick={() => PubSub.publish('canvas.PopInnerDiagram')} /> */}

        {/* <ToggleButtonGroup
                    size="small"
                    value={editToggle}
                    onChange={handleEditToggleChange}
                >
                    <ToggleButton value="pan" ><Tooltip title="Enable pan mode"><ControlCameraIcon className={editStyleAlways(editMode)} /></Tooltip></ToggleButton>
                    <ToggleButton value="edit" ><Tooltip title="Enable edit mode"><EditIcon className={editStyleAlways(!editMode)} /></Tooltip></ToggleButton>
                </ToggleButtonGroup> */}

        <Box m={1} className={style()} />
        <Typography
          className={classes.title}
          variant="h6"
          noWrap
          onClick={renameDiagram}
        >
          {titleText}
        </Typography>
      </Toolbar>
    </AppBar>
  );
};

type ButtonProps = {
  icon: any;
  tooltip: string;
  disabled?: boolean;
  onClick: (event: any) => void;
  className?: any;
};

const Button: FC<ButtonProps> = ({
  icon,
  tooltip,
  disabled = false,
  onClick,
  className,
}) => {
  return (
    <Tooltip title={tooltip} className={className}>
      <span>
        <IconButton
          disabled={disabled}
          onClick={onClick}
          style={{ padding: 5 }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
};

const useAppBarStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  title: {
    //flexGrow: 1,
    display: "block",
    // [theme.breakpoints.up('sm')]: {
    //     display: 'block',
    // },
  },
  space: {
    flexGrow: 1,
  },
  icons: {
    color: "white",
    display: "none",
    [theme.breakpoints.up("md")]: {
      display: "block",
    },
  },
  iconsDisabled: {
    color: "grey",
    display: "none",
    [theme.breakpoints.up("md")]: {
      display: "block",
    },
  },
  iconsAlways: {
    color: "white",
  },
  iconsAlwaysDisabled: {
    color: "grey",
  },

  iconsAlwaysDarker: {
    color: "Silver",
  },
  connectionIcons: {
    color: "green",
  },
}));
