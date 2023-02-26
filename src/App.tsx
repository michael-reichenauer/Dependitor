import React from "react";
import useWindowSize from "./common/windowSize";
import Activity, { useActivityMonitor } from "./common/activity";
import { useAppVersionMonitor } from "./common/appVersion";
import Diagram from "./application/Diagram";
import { ApplicationBar } from "./application/ApplicationBar";
import About from "./application/About";
import { LoginDlg } from "./application/LoginDlg";
import AlertDialog from "./common/AlertDialog";
import PromptDialog from "./common/PromptDialog";
import Nodes from "./application/Nodes";
import NodeLabelDialog from "./application/diagram/LabelEditor";
import { isAuthenticatorApp } from "./authenticator/AuthenticatorProtocol";
import { AuthenticatorPage } from "./authenticator/AuthenticatorPage";
import { AuthenticatorBar } from "./authenticator/AuthenticatorBar";
import { restoreVirtualConsoleState } from "./common/virtualConsole";
import { ThemeProvider, Theme, StyledEngineProvider, createTheme } from '@mui/material/styles';
import { isTestsApp, TestsApp } from "./common/tests";


declare module '@mui/styles/defaultTheme' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface DefaultTheme extends Theme { }
}
const theme = createTheme();

restoreVirtualConsoleState();

const App: React.FC = () => {
  if (isTestsApp()) {
    return (
      <>
        <StyledEngineProvider injectFirst>
          <ThemeProvider theme={theme}>
            <TestsApp />
          </ThemeProvider>
        </StyledEngineProvider>
      </>
    );
  }


  // If the authenticator app is requested, show that ui.
  if (isAuthenticatorApp()) {
    return (
      <AuthenticatorApp />
    );
  }

  return <DependitorApp />
};


const DependitorApp: React.FC = () => {
  const [size] = useWindowSize();

  // Enable user activity detection (e.g. moving mouse ) and new available web site at server detection
  useActivityMonitor();
  useAppVersionMonitor();

  return <>
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <ApplicationBar height={55} />
        <Diagram width={size.width} height={size.height - 55} />
        <About />
        <LoginDlg />
        <Nodes />
        <AlertDialog />
        <PromptDialog />
        <NodeLabelDialog />
        <Activity />
      </ThemeProvider>
    </StyledEngineProvider>
  </>;
};


const AuthenticatorApp: React.FC = () => {
  // Enable user activity detection (e.g. moving mouse ) and new available web site at server detection
  useActivityMonitor();
  useAppVersionMonitor();

  return (
    <>
      <ThemeProvider theme={theme}>
        <AuthenticatorBar height={55} />
        <AuthenticatorPage />
        <PromptDialog />
        <About />
        <AlertDialog />
      </ThemeProvider>
    </>
  );
};

export default App;
