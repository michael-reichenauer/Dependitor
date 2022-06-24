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

type ApplicationBarProps = {
  height: number;
};

// const randomStringFromServer = "1234512345";
// const userId = "user1";
// const username = "user_1";=
// const userDisplayName = "user 1";

const username = "michael";

const register = async () => {
  const authenticate: IAuthenticate = di(IAuthenticateKey);

  console.log("register");
  const isAvailable = await platformAuthenticatorIsAvailable();
  console.log("platformAuthenticatorIsAvailable", isAvailable);
  if (!isAvailable) {
    alert("Error: Biometrics not available");
    return;
  }

  const registrationOptions = await authenticate.getWebAuthnRegistrationOptions(
    {
      username: username,
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
  alert("Got verification options from server: OK");

  const options: any = registrationOptions;
  console.log("options1:", options);
  options.user.id = "12345" + options.user.id;
  console.log("options2:", options);

  let registrationResponse;
  try {
    // Pass the options to the authenticator and wait for a response
    registrationResponse = await startRegistration(options);
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
  console.log("registrationResponse", registrationResponse);
  alert("Registered on device: OK " + registrationResponse.id);

  const registrationVerificationResponse =
    await authenticate.verifyWebAuthnRegistration({
      username: username,
      registrationResponse: registrationResponse,
    });
  if (isError(registrationVerificationResponse)) {
    console.error("error", registrationVerificationResponse);
    alert(
      "Error: Failed to verify registration on server" +
        registrationVerificationResponse
    );
    return;
  }

  if (!(registrationVerificationResponse as any).verified) {
    console.error(
      "Failed to verify registration on server",
      registrationVerificationResponse
    );
    alert(
      "Error: Failed to verify registration on server: " +
        registrationVerificationResponse
    );
    return;
  }

  console.log("verified registration", registrationVerificationResponse);
  alert(
    "Registration verified by server: " +
      (registrationVerificationResponse as any).verified
  );
};

const verify = async () => {
  console.log("verify");
  const authenticate: IAuthenticate = di(IAuthenticateKey);

  // GET authentication options from the endpoint that calls
  const authenticationOptions =
    await authenticate.getWebAuthnAuthenticationOptions({
      username: username,
    });
  if (isError(authenticationOptions)) {
    console.error("error", authenticationOptions);
    alert("Error: failed to get authentication options from server");
    return;
  }
  console.log("authOptions", authenticationOptions);
  alert("Got authentication options from server OK ");

  let authenticationResponse;
  try {
    // Pass the options to the authenticator and wait for a response
    authenticationResponse = await startAuthentication(authenticationOptions);
  } catch (error) {
    console.error("Error", error);
    alert("Error: Failed to authenticate on device" + error);
    return;
  }

  console.log("asseResp1", authenticationResponse);
  alert(
    "Authenticated on device ok: " + authenticationResponse.response.userHandle
  );
  authenticationResponse.response.userHandle =
    authenticationResponse.response.userHandle.substring(5);
  console.log("asseResp2", authenticationResponse);

  // POST the response to the endpoint that calls
  const authenticationVerificationResponse =
    await authenticate.verifyWebAuthnAuthentication({
      username: username,
      authenticationResponse: authenticationResponse,
    });
  console.log("rsp", authenticationVerificationResponse);

  if (isError(authenticationVerificationResponse)) {
    console.error("error", authenticationVerificationResponse);
    alert(
      "Error: Failed to verify authentication on server: " +
        authenticationVerificationResponse
    );
    return;
  }

  alert(
    "Authenticated verified by server" +
      (authenticationVerificationResponse as any).verified
  );
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
