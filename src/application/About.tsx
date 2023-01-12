// The About dialog

import React from "react";
import { atom, useAtom } from "jotai";
import {
  Box,
  Button,
  Dialog,
  Link,
  Tooltip,
  Typography,
} from "@mui/material";
import { localBuildTime, localShortSha } from "../common/appVersion";
import { SetAtom } from "jotai/core/types";
import { isProduction } from "../utils/build";
import {
  enableVirtualConsole,
  isVirtualConsoleEnabled,
} from "../common/virtualConsole";

const aboutAtom = atom(false);
export const useAbout: () => [boolean, SetAtom<boolean>] = () =>
  useAtom(aboutAtom);

// About
const About: React.FC = () => {
  const [show, setShow] = useAbout();
  const versionText = `version: ${localBuildTime} (${localShortSha})`;

  return (
    <Dialog open={show} onClose={() => setShow(false)}>
      <Box style={{ width: 300, height: 180, padding: 20 }}>
        <Tooltip title={versionText}>
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
            Version: {versionText}
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
