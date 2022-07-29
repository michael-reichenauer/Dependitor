import React from "react";
import { atom, useAtom } from "jotai";
import {
  Box,
  Button,
  Dialog,
  Link,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { localBuildTime, localSha } from "../common/appVersion";
import { SetAtom } from "jotai/core/types";
import { isProduction } from "../common/utils";
import {
  enableVirtualConsole,
  isVirtualConsoleEnabled,
} from "../common/virtualConsole";
//import { useLogin } from "./Login";

// Test
const aboutAtom = atom(false);

export const useAbout: () => [boolean, SetAtom<boolean>] = () =>
  useAtom(aboutAtom);

const About: React.FC = () => {
  const [show, setShow] = useAbout();
  //const [, setShowLogin] = useLogin()

  // const hasShown = localStorage.getItem('hasShownAbout')

  // if (!show && hasShown !== 'true') {
  //     console.log('Set timeout')

  //     setTimeout(() => {
  //         localStorage.setItem('hasShownAbout', 'true')
  //         setShow(true)
  //     }, 3000);
  // }//

  // const enableCloudSync = () => {
  //     setShowLogin(true);
  // }

  return (
    <Dialog
      open={show}
      onClose={() => {
        setShow(false);
      }}
    >
      <Box style={{ width: 300, height: 180, padding: 20 }}>
        <Tooltip
          title={`version: ${localBuildTime} (${localSha.substring(0, 6)})`}
        >
          <Link
            component="button"
            underline="none"
            color="inherit"
            variant="h5"
            onClick={() => {
              enableVirtualConsole(!isVirtualConsoleEnabled());
              setShow(false);
            }}
          >
            About Dependitor
          </Link>
        </Tooltip>
        <Typography>A tool for modeling cloud architecture.</Typography>

        {!isProduction() && (
          <Typography style={{ fontSize: "10px", marginTop: 40 }}>
            Version: {`${localBuildTime} (${localSha.substring(0, 6)})`}
          </Typography>
        )}

        <Box
          style={{ position: "absolute", bottom: 20, left: "40%" }}
          textAlign="center"
        >
          {" "}
          <Button
            onClick={() => setShow(false)}
            variant="contained"
            color="primary"
          >
            Close
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};
export default About;
