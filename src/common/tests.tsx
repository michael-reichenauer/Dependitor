import React, { FC, useEffect } from "react";
import { Typography, AppBar, Toolbar, } from "@mui/material";
import { makeStyles } from "@mui/styles";
import AlertDialog from "./AlertDialog";
import PromptDialog from "./PromptDialog";
import { StoreDBTests } from "./db/StoreDBTests";
import { ILocalStoreKey } from "./LocalStore";
import LocalSubStore from "./LocalSubStore";
import { clearAllDiInstances, registerInstance } from "./di";

const tests = [
  () => new StoreDBTests(),
]


const testsUrlPath = "/tests"; // The base path which determines if authenticator is requested

export function isTestsApp(): boolean {
  return window.location.pathname.startsWith(testsUrlPath);
}


export const TestsApp: FC = () => {
  useEffect(() => {
    const runner = new TestsRunner();
    runner.run();
  }, []);

  return (
    <>
      <TestsBar height={55} />
      <AlertDialog />
      <PromptDialog />
    </>
  );
};


type TestsBarProps = {
  height: number;
};

const TestsBar: FC<TestsBarProps> = ({ height }) => {
  const classes = useAppBarStyles();

  return (
    <AppBar position="static" style={{ height: height }}>
      <Toolbar>
        {/* <AuthenticatorMenu /> */}
        <Typography className={classes.title} variant="h6" noWrap>
          Dependitor Tests
        </Typography>
      </Toolbar>
    </AppBar>
  );
};


const useAppBarStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  title: {
    display: "block",
  },
}));



class TestsRunner {
  private count: number = 0;
  private errorCount: number = 0;


  public run(): void {
    tests.forEach(t => this.runTestClass(t))

    if (this.errorCount === 0) {
      console.log(`%cTests done, total ${this.count} tests`, "color: #84d95f");
    } else {
      console.log(`%cTests done, Failed: ${this.errorCount} of total ${this.count} tests`, "color: #CD5C5C");
    }
  }


  private runTestClass(factory: any): void {
    clearAllDiInstances();

    const testsStore = new LocalSubStore("tests");
    registerInstance(ILocalStoreKey, testsStore);

    const instance = factory()
    const testMethods = this.getTestMethodNames(instance)
    const name = this.getTestClassName(instance)

    console.log(`Test class # ${this.count} '${name}' (with ${testMethods.length} tests)`);
    testMethods.forEach((methodName, index) => this.runTestMethod(name, instance, methodName, index + 1))

    testsStore.clear()
    clearAllDiInstances();
  }

  private runTestMethod(className: string, instance: any, methodName: any, index: number): void {
    try {
      this.count++;
      console.log(`  Test: # ${index} ${className}.${methodName}`)
      instance[methodName]()
    } catch (err) {
      this.errorCount++;
      console.error(err);
    }
  }

  private getTestMethodNames(instance: any) {
    const prototype = Object.getPrototypeOf(instance)
    console.log(prototype)
    return Object.getOwnPropertyNames(prototype)
      .filter(item => typeof prototype[item] === 'function' && item.endsWith("Test"))
  }

  private getTestClassName(instance: any) {
    const prototype = Object.getPrototypeOf(instance)
    if (typeof prototype['constructor'] === 'function') {
      return prototype['constructor'].name;
    }

    return ''
  }
}




